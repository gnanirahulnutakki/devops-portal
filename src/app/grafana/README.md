This folder implements a Grafana reverse-proxy at `/grafana/*`.

Purpose:
- Embed full Grafana UI inside DevOps Portal without exposing the Grafana token to the browser.
- Injects the org-scoped Grafana service account token on every proxied request.

Notes:
- This is a best-effort UI proxy. Some Grafana Live / websocket features may not work through Next.js route handlers.

