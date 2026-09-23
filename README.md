# Student Readiness Control Center

A tenant-isolated assessment workspace with a React dashboard, Express API, PostgreSQL source of truth, and MongoDB operational event log. All dashboard records come from authenticated API requests. Readiness is calculated on the server from actual assessment evidence.

## Quick start

Prerequisites: Docker Desktop with Linux containers and Compose v2. For native development and tests, install Node.js **22.13 or newer** and npm. Ports 5174, 4000, 5432 and 27018 must be available.

```sh
node scripts/setup.mjs
docker compose up --build
```

Open **http://localhost:5174**. The setup script creates random local credentials in ignored `.env` files, without overwriting existing files. Read `SEED_PASSWORD` from the root `.env` to sign in. Do not publish these files. If Node is unavailable, copy `.env.example` to `.env` and replace the password and JWT placeholders before running Compose.

| Organization      | Administrator        | Evaluator                | Viewer                |
| ----------------- | -------------------- | ------------------------ | --------------------- |
| Acme Training     | admin@acme.test      | evaluator@acme.test      | viewer@acme.test      |
| Northstar Academy | admin@northstar.test | evaluator@northstar.test | viewer@northstar.test |

All initial users share your locally generated `SEED_PASSWORD`. The organization name is a login credential qualifier because email is unique **within** a tenant. After login, the server ignores client tenant claims and resolves membership through the session's user record. Seeding is repeatable; it does not reset existing passwords or overwrite student changes.

## Local development

```sh
npm install
npm run setup
docker compose up -d postgres mongo
npm run generate -w backend
npm run db:migrate
npm run db:seed
npm run dev -w backend
# In another terminal:
npm run dev -w frontend
```

The Vite dev server proxies `/api` to port 4000. Docker serves the built frontend through nginx with the same proxy path. `npm run build` builds both workspaces. The API production entry point is `backend/dist/src/server.js`.

## Environment

| Variable          | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| DATABASE_URL      | PostgreSQL connection URI; local default database `readiness`          |
| MONGODB_URL       | MongoDB URI including database name; local port 27018                  |
| JWT_SECRET        | At least 32 random characters; rotation invalidates existing JWTs      |
| POSTGRES_PASSWORD | Compose PostgreSQL password; must match the native DATABASE_URL        |
| SEED_PASSWORD     | Initial local account password, at least 12 characters                 |
| PORT              | API listener; default 4000                                             |
| FRONTEND_ORIGIN   | Exact browser origin allowed for writes, default http://localhost:5174 |
| COOKIE_SECURE     | Set true behind HTTPS in production                                    |
| VITE_API_URL      | Frontend build-time API prefix, default /api                           |
| MONGO_PORT        | Compose host MongoDB port, default 27018                               |

Compose overrides database hosts with internal service names. Never use the example credentials outside local development. For an existing deployment, use managed secrets, TLS, separate migration credentials, database authentication, backups and least-privilege database accounts. This Compose environment binds exposed services to loopback; MongoDB authentication is intentionally delegated to production infrastructure.

## Architecture

```text
React Router → TanStack Query → typed fetch + Zod
                               ↓ cookie-authenticated API
Express controllers → services → readiness domain → Prisma repositories
                                                      ↓
                                                 PostgreSQL
                                                 transaction
                                          attempt + student projection
                                          idempotency response + outbox
                                                      ↓
                                            retrying outbox worker
                                                      ↓
                                                 MongoDB events
```

The four required competencies have fixed weights: frontend 30, backend 30, databases 25, problem solving 15. The latest non-voided attempt wins by `attemptedAt DESC, id DESC`. Decimal scores are calculated using integer hundredths before weighting. Missing evidence produces INCOMPLETE, regardless of score. Complete students are READY ≥80, NEARLY_READY ≥65, DEVELOPING ≥50, otherwise NEEDS_PREPARATION. Student score/status columns are transactional list projections; detail evidence is recomputed from attempts.

## API

All mutations require `X-Requested-With: readiness`; browser Origin, when present, must match FRONTEND_ORIGIN. Login sets an HttpOnly, SameSite=Strict cookie. JWTs contain user/session identifiers; authorization reads the active server-side user and tenant on every request. Logout revokes the session. Token lifetime is eight hours.

| Method | Path                       | Behavior                                                            |
| ------ | -------------------------- | ------------------------------------------------------------------- |
| POST   | /api/auth/login            | `{organization,email,password}`                                     |
| POST   | /api/auth/logout           | Revoke session and clear cookie                                     |
| GET    | /api/auth/me               | Safe user and membership information                                |
| GET    | /api/students              | search, status, sort, cursor, limit                                 |
| GET    | /api/students/:id          | Student, version, evidence, missing competencies and readiness      |
| PATCH  | /api/students/:id          | name and/or phone with expectedVersion                              |
| POST   | /api/students/:id/attempts | competency, score, attemptedAt; requires Idempotency-Key            |
| GET    | /api/students/:id/activity | Bounded MongoDB events and pending delivery count                   |
| GET    | /api/operations            | Admin-only tenant rejection metrics and duplicate-success detection |
| GET    | /api/health                | Relational database connectivity                                    |

Lists support allowlisted name, email, score, status, createdAt sorting, each with asc/desc. ID is the stable secondary sort. Cursors are HMAC signed and bound to tenant, search, status and sort; limit is 1–100. URL parameters preserve the UI's list state. A missing/deleted cursor requests a refresh. Pagination is a live view, not a snapshot across concurrent writes.

ADMIN and EVALUATOR may create attempts and update students. VIEWER may only read. Operations requires ADMIN. Foreign-tenant identifiers get the same 404 as nonexistent identifiers. Strict validation rejects extra fields, including tenantId, role, evaluatorId and manually supplied version. Composite foreign keys also prevent cross-tenant evidence at the database level.

Errors have `{code,message,requestId,fields}`. Internal errors expose no stack, SQL or connection information. Correlate the response requestId with safe structured backend logs.

## Idempotency, locking and failure handling

The key is scoped to a tenant. A transaction-scoped PostgreSQL advisory lock serializes requests with the same key across API instances. The request fingerprint includes the target student and normalized validated payload. Identical requests replay the stored status and body; different payloads return IDEMPOTENCY_CONFLICT. Keys are retained after their seven-day expiration marker so delayed retries cannot accidentally create a second logical operation. There is no automatic key-reuse cleanup.

A student row lock serializes different assessment operations for the same student. Attempt, recalculated projection, version increment, stored response and outbox event commit together. A failed transaction leaves none of these changes. Student edits perform an atomic compare-and-increment against expectedVersion; a stale version returns 409 without partial changes.

PostgreSQL and MongoDB are not a distributed transaction. The worker inserts append-only events, with a unique eventId index, then marks the outbox record delivered. A crash between these steps causes a duplicate-key response on retry, safely treated as already delivered. Transient delivery failures use capped exponential backoff. MongoDB failure does not invalidate a committed assessment; the activity panel reports pending events once MongoDB is reachable. Validation and idempotency rejections for authorized existing students enter the same durable outbox. Authentication failures and unknown/foreign students do not create student events.

GET /api/operations groups success events by tenant and attempt to find count >1, reports delivered success/rejection totals, their ratio, and pending outbox records. The ratio is based on delivered attempt-operation events, not all HTTP requests. Replay creates neither another attempt nor another success event. Replay under another evaluator in the same tenant still returns the original logical result.

## Tenant switching and request races

The frontend uses HttpOnly cookies, not browser-stored JWTs. Query keys include tenant ID, user ID, session ID and parameters. Switching accounts immediately hides tenant content, aborts outstanding requests, cancels and clears the query client, then invalidates queries for the new identity. A request-generation barrier rejects late responses even if a transport ignores AbortSignal. Search and page results use distinct query keys and do not retain the previous query's data while loading. Retry of an uncertain assessment preserves its idempotency key as long as form values are unchanged.

## Tests and QA

Start PostgreSQL and MongoDB first, then:

```sh
npm run generate -w backend
npm test
npm run typecheck
npm run lint
npm run build
npm audit
# With the complete Docker stack running:
npx playwright install chromium
npm run test:e2e
```

`npm test` runs the pure domain suite, Supertest against real PostgreSQL/MongoDB, and React Testing Library tests. The integration runner creates and migrates separate `readiness_test` databases. It refuses unexpected source database names. The local PostgreSQL account requires CREATEDB for this runner. Tests append unique fixtures and never truncate your application data. A rollback test installs a temporary failure trigger only in the isolated test database and removes it in a finally block. Do not run test databases under production credentials.

Frontend transport fakes deliberately control latency and failures; they test actual request cancellation, cache handling and forms. Backend integration tests do not mock databases. Playwright exercises the production build against the live API. See QA_REPORT.md for executed results and manual failure drills.

## Deployment and limitations

The included stack is a reproducible local deployment, not a fully provisioned public service. Before horizontal production scaling, put shared Redis or gateway limits in front of login, assessment and update endpoints. Current per-process limits allow 30 login requests / 15 minutes per IP and 60 mutations / minute per authenticated user. Configure trusted proxies explicitly for the deployment; arbitrary forwarded headers are not trusted.

Deferred: user provisioning and password reset, server-side RLS as additional defense, retention/archive jobs, refresh-token rotation, administrative attempt voiding, and outbox lease-based batching. Voided evidence is supported by the model and domain, but no public void route is exposed. Student provisioning is currently seed/database administration; the requested API supports listing, reviewing and editing existing students. Activity sorts by occurrence time, then event ID, with a bounded compound cursor. The worker may perform duplicate insert attempts when replicated, while unique event IDs prevent duplicate storage.

For large cohorts, index tuning and a materialized latest-evidence relation can reduce detail computation. Font files load from Google Fonts with local sans-serif fallbacks; the application still works offline once assets are built. Readiness labels accompany color, inputs have labels, feedback uses live regions, and navigation includes a skip link and heading focus. A formal WCAG audit remains a deployment responsibility.

Stop with `docker compose down` (retains data). Never run `down -v` unless you intend to delete this project's database volumes. Back up both databases before schema upgrades. The initial migration creates new tables and constraints; rollback is to the previous application image plus a database restore, rather than destructive down-migration.

## Engineering references

The transaction design follows [Prisma v6 transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions) and [PostgreSQL transaction-level advisory locking](https://www.postgresql.org/docs/17/explicit-locking.html). Query cancellation consumes the AbortSignal provided by [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
