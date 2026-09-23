# QA verification

Verified locally on 23 September 2026 using Node 22.23.2, real PostgreSQL 17, MongoDB 7, Docker Compose and Chromium. Screenshots are in `docs/screenshots/`.

## Executed checks

| Check | Result |
| --- | --- |
| npm install / container npm ci | Passed; locked dependencies installed |
| Prisma generate | Passed |
| Database migration | Passed on application and separate integration database |
| Seed | Passed; repeated startup preserved existing rows |
| Domain tests | 16 passed |
| Real-database API integration tests | 33 passed |
| React Testing Library tests | 9 passed |
| Playwright Chromium workflows | 2 passed |
| npm test | Passed, 58 tests across workspaces |
| npm run build | Passed for backend and frontend |
| npm run lint | Passed |
| npm run typecheck | Passed with strict TypeScript |
| npm audit | Zero known vulnerabilities in resolved dependencies at verification time |
| docker compose up --build -d | Passed; frontend, backend, PostgreSQL and MongoDB running |
| Live MongoDB outage and recovery | Assessment remained committed; pending outbox delivered one success event after restart |
| Browser runtime errors | None during desktop/mobile screenshot flow |
| Mobile viewport | 390px viewport and document width; no horizontal page overflow |
| Credential review | Generated secrets absent from tracked source/history; environment files absent from final backend image |

**60 automated tests passed**, plus the live outage drill and manual visual review. The browser tests run against nginx's production frontend build and the real API, not Vite fixtures.

## Security and consistency review

- Authentication: invalid credentials and absent sessions rejected; session identity contains no password hash. Logout revokes server-side state. Suspended tenants lose access through existing sessions.
- Tenant spoofing and IDOR: client tenant query fields rejected; foreign student detail, mutation and activity return the same 404 as nonexistent IDs. Foreign cursors are rejected. Composite FKs reject cross-tenant evidence independently of HTTP validation.
- RBAC: viewers cannot record attempts; operational metrics require ADMIN. Evaluator identity comes from authentication. Mutation schema allowlists reject injected fields.
- CSRF: unsupported write headers and cross-origin writes are rejected. Cookies are HttpOnly and SameSite=Strict; HTTPS deployments must enable Secure.
- Concurrent duplicates: six identical parallel requests returned the same attempt ID, with one idempotency record and one MongoDB success event. Same key with a changed payload conflicted. Keys remain independent across tenants.
- Stale writes: concurrent updates with the same expectedVersion produced one 200 and one 409, with exactly one version increment.
- Transaction rollback: a test-only SQL trigger failed the outbox insert after the earlier attempt/projection writes; no partial attempt, version update or replay record survived, and the API returned a safe 500.
- Event retries: simulated redelivery after a lost acknowledgement and concurrent worker passes stored one event. Imported duplicate events were detected, and rejection rates matched expected counts.
- Frontend races: late search responses did not replace current data. Both the transport-level generation barrier and the actual AuthProvider/Students integration prevented old-tenant rendering after an account switch.
- Form feedback: duplicate submission was disabled, transport retries retained their key, stale-update conflicts triggered refresh, and success/loading/error feedback rendered correctly.

## Readiness and application acceptance

All five statuses, exact thresholds 49.99/50, 64.99/65 and 79.99/80, scores 0/100, unequal weights, missing competencies, voided latest evidence, older valid evidence and equal-time ID tie-breaking passed domain or database tests. Student list search, filtering, stable sorting, signed pagination, detail evidence, evaluator/timestamps, readiness explanation, editing and assessment creation were exercised through API and/or browser tests.

Activity is student/tenant scoped, chronologically paginated and safe-metadata-only through application writers. Pending events remain durable in PostgreSQL during MongoDB outages. The frontend has empty, error, refreshing, partial readiness, success and conflict states, responsive layouts, labels, keyboard focus styles and readiness text independent of color.

## Defects found and corrected during QA

1. Local Node 18.15 was unsupported: installed a local Node 22 runtime for execution; documented Node 22 prerequisite and pinned Docker runtime.
2. Initial package versions had advisories: updated affected routing/test tooling and selected a compatible audited Prisma version; final audit reported zero vulnerabilities.
3. Prisma client generation and workspace CLI resolution needed explicit paths: corrected runner resolution and documented generation before native tests.
4. Existing services owned ports 27017 and 5173: used 27018 and 5174 without stopping unrelated services.
5. Docker build context included a nested environment file: added recursive exclusions, rebuilt, and verified environment files are absent from the final image. No generated credentials were committed.
6. An initial MongoDB connection failure required explicit reconnection: added reconnect calls and reran the stop/start outage drill successfully.
7. A screen-reader-only table label escaped the mobile scroll container: positioned the container, rebuilt and reran Chromium's no-overflow assertion successfully.
8. A browser assertion ambiguously matched two legitimate live regions: targeted the assessment confirmation specifically and reran both E2E flows.

## Reproduction and scope

Follow README.md for setup and commands. Run `npm run test:outage -w backend` only against the local Compose stack: it deliberately stops and restarts this project's MongoDB and records a real assessment. Integration tests use separate `readiness_test` databases. Browser tests edit seeded application data.

Public production deployment still requires the explicitly documented infrastructure: HTTPS, managed credentials, authenticated private MongoDB, shared rate limiting, monitoring/alerting, backups and account provisioning. A formal third-party security review, load test and WCAG audit were not performed. These are stated limitations, not implied successful checks.
