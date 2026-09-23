# Engineering decisions

## PostgreSQL owns relational truth and readiness projections

Decision: preserve immutable attempts and maintain student list score/status in the same transaction. Detail readiness is a pure calculation from actual evidence.

Reason: a list needs indexed score/status filtering without loading every historical attempt. Composite tenant/student and tenant/evaluator foreign keys enforce relational tenant consistency.

Trade-off: projections must be maintained by every future evidence writer, including any void workflow. Direct administrative writes require recalculation. Consequence: the only public evidence writer is the transactional attempt service. Model constraints protect score bounds; migrations and domain tests protect the fixed competency catalog.

## Transactional outbox between PostgreSQL and MongoDB

Decision: commit an outbox row alongside a successful attempt, then deliver events asynchronously with a unique MongoDB eventId. No cross-database transaction is claimed.

Reason: MongoDB may fail after PostgreSQL commits. Retrying inserts with stable IDs gives at-least-once delivery and one stored event.

Trade-off: activity is eventually consistent, and pending outbox records need monitoring. Consequence: API success means relational commit; activity exposes pending count. The worker logs safe delivery failures and retries with backoff. An outage must not create false success events or undo valid evidence.

## Advisory locks for idempotency, row locks for assessment state

Decision: lock a hash of tenant and key for the transaction, then lock the scoped student row. Retain replay records beyond the expiration marker.

Reason: inserting a unique key alone does not provide a convenient winner/loser response protocol. Advisory locks serialize identical logical operations without a global application mutex. Row locks serialize distinct keys affecting the same readiness projection.

Trade-off: contended requests wait, consume pool resources and may time out; hash collision can unnecessarily serialize unrelated operations but cannot mix authorization or results. Consequence: use bounded transaction timeouts, retry failed transport calls with the same key, monitor contention, and keep external network calls out of transactions.

## Server-resolved sessions and tenant-aware query caches

Decision: JWT carries user and session references, not authoritative tenant claims. Database lookup resolves current user role and active organization. Browser uses HttpOnly cookies. Query keys carry session identity, and a generation counter supplements cancellation.

Reason: role changes and tenant suspension take effect without waiting for JWT expiry; a delayed previous-tenant response must not rehydrate the next workspace.

Trade-off: one session lookup per request and deliberate loading states on account/query changes. Consequence: no stale-while-revalidate reuse across identities. Session revocation makes logout effective even if a cookie is copied. SameSite cookies, explicit write headers and Origin checks provide CSRF protection for the supported browser flow.

## Scoped live cursors rather than a long-lived snapshot

Decision: stable allowlisted ordering with ID tie-break, signed cursor bound to tenant and filters.

Reason: bounded queries and tamper rejection are straightforward without arbitrary SQL fragments. Trade-off: students can move between pages during concurrent edits; cursors are not an export snapshot. Consequence: refresh restarts pagination and invalidated cursors report a safe validation error.

## Consciously deferred production infrastructure

Shared rate limiting, managed identity/provisioning, database RLS, retention jobs and outbox leases are deferred. They depend on hosting topology and organization policy. Current application authorization, FK isolation, per-process rate limiting and retry-safe event storage remain implemented and tested. These decisions do not justify deploying anonymous MongoDB or local seed accounts onto the public internet. Production deployment must add database credentials, network restrictions, HTTPS and managed secret delivery.
