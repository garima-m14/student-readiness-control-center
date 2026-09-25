# Incident Investigation Report: Production Outage & Data Corruption

---

## 1. Summary of Facts vs. Hypotheses & Failure Mapping

### 1.1 Observed Symptoms & Direct Evidence

| Symptom | Evidence / Root Cause | Category |
| :--- | :--- | :--- |
| **Double Creation of Attempts** (Single click created two attempts: `991` and `992`) | **Logs:** `req=a91` and `req=b03` both processed `POST /students/s44/attempts` with `key=k-778`. Both issued `sql attempt.insert` and committed.<br>**Schema:** `idempotency_records` lacks a `UNIQUE(tenant_id, key)` constraint, allowing concurrent insertion of identical keys. | **Failure 1:** Race condition / missing idempotency constraint |
| **Cross-Tenant Data Exposure** (Tenant `t-green` saw another tenant's student data) | **Logs:** `10:12:04.331 req=c10 tenant=t-green GET /students?status=READY cache=hit cacheKey=students:READY`<br>**Facts:** Cache key was recently changed from `tenantId:status:page` to `status` in the 10:05 UTC deployment. | **Failure 2:** Cross-tenant cache poisoning due to non-isolated cache key |
| **Score Anomaly** (Score changed 78 $\rightarrow$ 84 $\rightarrow$ 81 upon refresh) | **Facts:** Application calculates `students.current_score` by reading all attempts in application code.<br>**Logs:** Race condition created duplicate attempt score (90), inflating average score to 84. Duplicate resolution or read inconsistency later showed 81. | **Failure 3:** Non-atomic read-modify-write score aggregation combined with duplicate data |
| **MongoDB Timeout Handled Softly** | **Logs:** `10:12:01.211 req=b03 mongo event.insert eventId=e-992 timeout`<br>**Facts:** MongoDB write is awaited, but error is caught and only logged without rolling back SQL transaction or retrying. | **Failure 4:** Unhandled asynchronous state inconsistency between SQL and MongoDB |

---

## 2. First 15 Minutes: Containment & Emergency Response Sequence

The priority during the first 15 minutes is **halting cross-tenant data leaks** and **stopping data duplication** without causing unnecessary downtime.

### Containment Timeline (0–15 Minutes)

1. **T+0: Roll Back Deployment or Flush/Disable Shared Cache (Immediate - Containment 1)**
   * **Action:** Immediately purge Redis/Memcached cache and revert the cache key logic back to `tenantId:status:page` (or perform an immediate emergency rollback to pre-10:05 UTC release).
   * **Reason:** Stop ongoing cross-tenant data leaks immediately.

2. **T+5: Enable API Gateway / WAF Rate Limiting on Retry Requests (Containment 2)**
   * **Action:** Enforce strict client-side deduplication at the gateway layer or temporarily reject rapid concurrent duplicate request keys (`POST /students/*/attempts`).

3. **T+8: Assess Data Integrity & Freeze Automated Background Aggregations**
   * **Action:** Pause automated asynchronous worker jobs calculating `current_score` or status updates to avoid further propagating corrupt state.

4. **T+12: Communicate with Stakeholders**
   * **Action:** Issue incident notification to affected tenants regarding transient UI score display errors.

---

## 3. Durable System Corrections

### 3.1 Idempotency & Concurrency Control
Add a unique composite key constraint to `idempotency_records` and implement atomic insertion handling via SQL `INSERT ... ON CONFLICT` or database-level lock.

```sql
-- DDL Migration
ALTER TABLE idempotency_records 
ADD CONSTRAINT unique_tenant_idempotency_key UNIQUE (tenant_id, key);

CREATE INDEX idx_attempts_tenant_student ON attempts(tenant_id, student_id);
```

### 3.2 Cache Isolation
Enforce multi-tenant cache key namespaces via centralized cache key builders.

```typescript
// Multi-tenant safe cache key construction
function getCacheKey(tenantId: string, status: string, page: number): string {
  if (!tenantId) throw new Error("Tenant context required for cache operations");
  return `tenant:${tenantId}:status:${status}:page:${page}`;
}
```

### 3.3 Score Recomputation (Atomic & SQL-Driven)
Eliminate application-side read-modify-write loops. Move score aggregations directly into database transactions or materialised views.

```sql
-- Atomic score update calculation
UPDATE students s
SET current_score = (
    SELECT AVG(score) 
    FROM attempts a 
    WHERE a.student_id = s.id 
      AND a.tenant_id = s.tenant_id
      AND a.is_deleted = FALSE
)
WHERE s.id = $1 AND s.tenant_id = $2;
```

### 3.4 Outbox Pattern for MongoDB Event Reliability
Do not write directly to MongoDB during HTTP request execution if errors are suppressed. Use a Transactional Outbox Pattern.

```
+------------------+         +-----------------------+
|  RDBMS Engine    |         | Outbox Worker Service |
|  (PostgreSQL)    |         +-----------------------+
|  - attempts      |                     |
|  - outbox_events | --(Poll/CDC)--------+--> [MongoDB Event Store]
+------------------+
```

---

## 4. Safe Data Repair Approach (Non-Destructive)

To repair duplicate attempts without risking data loss, soft-delete duplicates by preserving the earliest committed attempt (`MIN(id)`).

```sql
-- Step 1: Identify and quarantine duplicates using CTAS
CREATE TABLE temp_duplicate_attempts AS
WITH ranked_attempts AS (
    SELECT 
        id,
        tenant_id,
        student_id,
        score,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY tenant_id, student_id, score, DATE_TRUNC('second', created_at)
            ORDER BY id ASC
        ) as rank_num
    FROM attempts
    WHERE created_at >= '2026-09-23 10:05:00 UTC'
)
SELECT * FROM ranked_attempts WHERE rank_num > 1;

-- Step 2: Soft-delete identified duplicates
UPDATE attempts
SET is_deleted = TRUE, updated_at = NOW()
WHERE id IN (SELECT id FROM temp_duplicate_attempts);

-- Step 3: Recompute student scores for affected records
UPDATE students s
SET current_score = sub.avg_score
FROM (
    SELECT student_id, AVG(score) as avg_score
    FROM attempts
    WHERE is_deleted = FALSE
    GROUP BY student_id
) sub
WHERE s.id = sub.student_id;
```

---

## 5. Verification: Tests, Queries, Dashboards, and Alerts

### 5.1 Verification Queries
Verify zero cross-tenant cache leaks and zero active duplicate idempotency keys:

```sql
-- Check for duplicate idempotency keys
SELECT tenant_id, key, COUNT(*) 
FROM idempotency_records 
GROUP BY tenant_id, key 
HAVING COUNT(*) > 1;
```

### 5.2 Alerts & Dashboards

* **Alert 1 (High Priority):** `rate(mongodb_event_write_failures_total[5m]) > 0`
* **Alert 2 (Critical):** `sum(cache_misses_with_missing_tenant_id_total) > 0`
* **Dashboard Monitor:** Concurrent DB Write Lock Wait Times & Duplicate Key Violation Counts.

---

## 6. Missing Evidence & Acquisition Plan

| Missing Evidence | Purpose / Value | How to Obtain |
| :--- | :--- | :--- |
| **Full Redis Cache Access Logs** | Quantify exact number of tenants affected by cross-tenant cache leak between 10:05 and 10:12 UTC. | Export Redis audit logs / command history for key `students:READY`. |
| **Client-side Network Traces / PCAP** | Confirm whether client triggered double HTTP POSTs (e.g., lack of button disabling on submit). | Pull front-end telemetry (Sentry/Datadog RUM events) for `u17`. |
| **MongoDB Event Audit Trail** | Identify missing events corresponding to attempt `992` that timed out. | Query MongoDB `eventId=e-992` directly or inspect MongoDB primary log at `10:12:01 UTC`. |
