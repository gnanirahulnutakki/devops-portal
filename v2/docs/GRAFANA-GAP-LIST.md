# Grafana Feature Hardening Gaps (Enterprise Grade)

## Missing / Needs Tightening
- Tenant enforcement: middleware does not validate org membership or set AsyncLocalStorage; Prisma tenant extension is not strict; RLS policies absent. Grafana routes currently trust org context implicitly.
- RBAC: Grafana routes are not role-gated (ADMIN/READWRITE) and not checked against org membership.
- Alerts/folders UI: service supports folders/alerts, but UI does not surface them or allow folder/tag filtering.
- Render security: iframe lacks sandbox/referrer controls and cache headers; render API has no rate limiting/backoff.
- Error/empty states: monitoring page lacks "Grafana not configured" and "No dashboards" tailored messaging.
- Tests: no API route tests or component tests for Grafana list/render; no org-scoping contract tests.
- Perf/CI gates: Lighthouse/axe/security scans not targeting monitoring pages; no throttling/backoff on render fetches.
- Token handling: routes rely on env API key only—no per-org key rotation/validation or audit logging of render calls.

## Required Work Items
- Enforce org membership in middleware; set ALS; require orgId in Grafana routes; add RLS policies and strict Prisma extension.
- Gate Grafana routes by role; audit org membership per request.
- UI: add folders/alerts sections, folder/tag filters, and config/empty/error states.
- Secure iframe: add sandbox/referrerpolicy, cache-control; add per-user/org rate limiting on render endpoint.
- Tests: add route/component/contract tests for Grafana list/render with org scoping.
- CI: include monitoring pages in Lighthouse/axe; add backoff in fetcher/render proxy.
- Token: support per-org Grafana keys (from org settings), key rotation, and audit render calls.
