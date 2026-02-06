# Grafana Feature Hardening Gaps (Enterprise Grade)

## Resolved
- [x] **Critical bug**: `isGrafanaConfigured` was async but called without `await` in all 4 API routes (dashboards, alerts, folders, render) -- the not-configured guard never fired.
- [x] **Consistent not-configured handling**: All routes now return `GRAFANA_NOT_CONFIGURED` error uniformly; dashboards route previously returned an empty success response.
- [x] **Integration metrics**: All Grafana service calls (listDashboards, listAlerts, listFolders) are now tracked via `trackIntegrationCall` for latency/error metrics.
- [x] **Alert error handling**: Alerts route now logs a warning and returns a `warning` field when Unified Alerting API fails, instead of silently swallowing errors.
- [x] **Folder/dashboard external links**: URLs are resolved to absolute URLs in the service layer; folder component no longer relies on `NEXT_PUBLIC_GRAFANA_URL` env var (broken for org-scoped setups).
- [x] **Dead code removal**: Stale `lib/integrations/grafana.ts` and `lib/integrations/grafana-render.ts` removed (superseded by org-scoped `lib/services/grafana.ts`).
- [x] **Removed misleading `isGrafanaConfiguredSync`**: Sync-only env check was misleading in a multi-tenant setup with org-scoped credentials.
- [x] **Alert list UX**: Alerts sorted by severity (alerting/error first), relative timestamps shown, firing rows highlighted.
- [x] **Dashboard preview dialog**: Loading spinner, error state with fallback link, theme-aware (respects system dark mode preference), "Open in Grafana" button in dialog header.
- [x] **Iframe security**: sandbox + referrerPolicy already present; render API has org-scoped rate limiting (20/min) with Retry-After headers.

## Remaining Work Items
- Tenant enforcement: RLS policies for Grafana-related data (currently relies on middleware org validation -- adequate but not defense-in-depth at DB level).
- RBAC granularity: Grafana routes are gated at `USER` role; consider `READWRITE` for render-heavy operations or per-dashboard access control.
- Token handling: Routes rely on a single API key per org -- no per-user key rotation/validation or audit logging of render calls.
- Tests: No API route tests or component tests for Grafana list/render; no org-scoping contract tests.
- CI gates: Lighthouse/axe scans not targeting monitoring pages; could add visual regression tests for dashboard grid.
