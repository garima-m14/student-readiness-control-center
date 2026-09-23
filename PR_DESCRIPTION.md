# Student Readiness Control Center

## Summary

Training organizations can sign in to an isolated workspace, review student readiness, inspect current competency evidence, record assessments and edit student contact details. Duplicate or concurrent submissions preserve one logical assessment, and stale student edits return a conflict.

## Architecture

React/TypeScript/Vite with React Router, TanStack Query, Tailwind and response validation calls a layered Express API. Prisma/PostgreSQL owns tenants, users, sessions, students, attempts, idempotency records and an outbox. A retrying worker delivers append-only MongoDB operational events. Readiness calculation is a pure domain function.

## Implemented functionality

- Cookie/JWT authentication, session revocation, active tenant checks and ADMIN/EVALUATOR/VIEWER authorization.
- Tenant-scoped student search, readiness filters, stable sorts and bounded signed cursors.
- Four weighted competencies, latest non-voided evidence, deterministic timestamp ties and incomplete status.
- Transactional assessments, same-key replay/conflict handling and row-level serialization.
- Compare-and-increment student updates with field allowlists.
- Activity pagination, pending delivery feedback, duplicate detection and rejection metrics.
- Responsive directory/detail/login UI with loading, empty, error, success and conflict feedback.
- Cache cancellation and late-response rejection across searches and account switches.
- Repeatable seed data, migrations, Compose deployment and automated tests.

## Risk areas and security considerations

Every tenant-owned request is scoped through authenticated membership, with composite FKs preventing cross-tenant evidence. Foreign IDs return non-disclosing 404s. Arbitrary ordering, mass assignment and client evaluator identity are rejected. Safe error responses expose correlation IDs without SQL or stacks. HttpOnly SameSite cookies use explicit write headers and Origin checks. Current rate limits are per process and must move to shared infrastructure for horizontal deployment.

## Database migration impact

Initial additive schema with unique per-tenant emails, tenant/key idempotency uniqueness, evidence indexes, session storage, tenant-consistent FKs and domain CHECK constraints. Migration and seed run during local Compose startup. Production should run migrations as a separate controlled deployment step and disable demo seeding.

## Testing performed

See QA_REPORT.md for actual command results. Tests cover exact readiness boundaries, missing/voided/tied evidence, real API authorization and pagination, parallel idempotency, optimistic conflicts, rollback with a real SQL trigger failure, frontend request races, retry behavior and browser workflows. Tests use isolated readiness_test databases rather than mocks for persistence.

## Observability and failure handling

Request IDs are returned in headers and errors. Outbox delivery emits structured safe failure codes, and admin metrics expose pending records, event counts and rejection rate. MongoDB failures leave committed relational work and pending events intact. Duplicate delivery is deduplicated by eventId. SQL failures roll back the entire assessment operation.

## Rollback strategy

Stop the new application/worker, deploy the previous image and preserve database volumes. Back up before migration. If the initial schema must be removed, restore a tested pre-deployment backup; no automatic destructive down-migration is supplied. Do not delete outbox rows while undelivered events remain.

## Known limitations and deferred improvements

Local Compose is not public production infrastructure. Managed secrets, TLS, authenticated MongoDB, shared abuse protection, retention policies, account provisioning and formal accessibility review remain deployment work. No public student-create or attempt-void route was requested; seed/admin database workflows provision data. Pagination is live rather than snapshot-isolated across page visits. Idempotency keys remain reserved past expiresAt, intentionally favoring duplicate prevention over storage reclamation.
