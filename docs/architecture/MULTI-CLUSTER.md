# Multi-Cluster & Per-Org Integrations

How clusters get registered, how their credentials are stored, and how the per-tenant ArgoCD / Grafana / Prometheus integrations get resolved.

This document is grounded in the current `src/` runtime — it is not aspirational. Each section names the files and Prisma models you'd inspect to verify the behavior.

## TL;DR

- A **cluster** belongs to one **organization**; it stores either an encrypted kubeconfig or just enough config to mint a per-request token.
- An **integration credential** (ArgoCD / GitHub / Grafana / Prometheus) also belongs to one organization, encrypted at rest, looked up by `(organizationId, provider, isDefault=true)`.
- Tenant isolation is enforced in three layers: middleware → Prisma extension (`set_config('app.organization_id', ..., true)`) → Postgres RLS policies.
- No agent is installed in the target cluster today. The portal speaks directly to the cluster's API server using the credentials the operator pasted in. The in-cluster **Portal Agent** in the roadmap (v0.5+) targets environments where that direct path isn't available.

## Data model

`prisma/schema.prisma` (relevant slice — column types abbreviated):

```prisma
model Cluster {
  id              String   @id
  name            String
  slug            String
  kubeconfig      String?  @db.Text   // encrypted (AES-GCM via src/lib/encryption.ts)
  config          Json?                // auth-type-specific JSON, plus encrypted token fields
  organizationId  String   @map("organization_id")  // snake_case in Postgres for RLS

  @@unique([organizationId, slug])
  @@index([organizationId])
}

model IntegrationCredential {
  id              String              @id
  organizationId  String
  provider        IntegrationProvider // ARGOCD | GITHUB | GRAFANA | PROMETHEUS | ...
  payload         String   @db.Text   // encrypted JSON: {url, token, ...}
  isDefault       Boolean
  expiresAt       DateTime?

  @@index([organizationId, provider])
}
```

The two models are tied to `Organization` with `onDelete: Cascade`. The `clusters` and `integration_credentials` tables both have RLS policies installed by `npm run db:setup-rls` — see `docs/operations/SECURITY_AND_RELIABILITY.md#row-level-security-postgres-rls`.

## Cluster registration

### UI flow

`/clusters/new` → posts to `POST /api/clusters`. The form collects:

- `name`, `slug` — display + URL slug, unique within the org
- `provider`, `region`, `environment` — display metadata
- `authType` — one of `standard` / `duplo` / `eks`
- For `standard`: a kubeconfig YAML pasted into a textarea
- For `duplo` / `eks`: provider-specific fields (Duplo host + token + plan ID; or EKS cluster name + region + endpoint + CA + IAM creds)

### What the API does

`src/app/api/clusters/route.ts`:

1. Resolves the calling user's org via the middleware-injected `x-organization-id` header.
2. Encrypts the kubeconfig (or the secret fields inside `config`) using `TOKEN_ENCRYPTION_KEY`. See `src/lib/encryption.ts` for the AES-256-GCM implementation; `KEY_2` rotation is supported for re-encryption.
3. Inserts a `Cluster` row with `organizationId = ctx.tenant.organizationId`. RLS would refuse the insert if the GUC didn't match, so a misrouted request fails closed at the DB.

The kubeconfig is **never logged** — neither encrypted nor plaintext — and `pino` serializers in `src/lib/logger.ts` are responsible for keeping it out of structured logs.

## Auth types — what `loadKubeConfigFromClusterAsync` actually does

`src/lib/services/kubernetes.ts:loadKubeConfigFromClusterAsync(cluster)` is the single entry point that turns a stored `Cluster` row into a usable `KubeConfig`. It branches on `cluster.config.authType`:

| `authType`  | What's stored                                                                         | Per-request flow                                                                                                  |
|-------------|---------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| `standard`  | Encrypted full kubeconfig YAML in `cluster.kubeconfig`                                | `decrypt(kubeconfig)` → `KubeConfig.loadFromString()`. Cheapest path; suits long-lived static kubeconfigs.        |
| `duplo`     | `{ duploHost, duploToken (encrypted), planId, isAdmin }` in `cluster.config`          | Mint a fresh kubeconfig by calling Duplo's k8sConfig endpoint with the bearer token. Result is cached per `(host, planId)`. |
| `eks`       | `{ clusterName, region, endpoint, caData, accessKeyId (enc), secretAccessKey (enc), roleArn }` | Use STS to get a presigned token, build a kubeconfig in memory. Result is cached per `(clusterName, region)`.    |

Token cache lives in process memory (`src/lib/services/cluster-auth.ts`) with a TTL shorter than the upstream token's lifetime. On a 401/403 from the apiserver the call site invalidates the cache entry and retries once with a fresh mint — that retry-once-then-fail behavior is intentional, to keep an expired-token storm from looping.

If you add a new auth type:

1. Extend `ClusterAuthType` in `src/lib/services/cluster-auth.ts`.
2. Add a `generateKubeconfig` branch returning a kubeconfig YAML.
3. Add the auth fields to the `/clusters/new` form and to `cluster.config`.
4. Make sure any new sensitive fields are encrypted at write time (and decrypted in `loadKubeConfigFromClusterAsync`).

## Per-org integrations (ArgoCD as the example)

ArgoCD is the most-exercised integration; GitHub and Grafana follow the same pattern.

`src/lib/services/argocd.ts:getArgoCreds(organizationId)`:

1. **Preferred path** — `getArgoCDCredentials(organizationId)` looks up the default `IntegrationCredential` row where `provider=ARGOCD` and `isDefault=true`, decrypts the payload, returns `{ url, token, insecure }`. This is the path Settings → Integrations creates.
2. **Legacy fallback** — reads `Organization.settings.argocdUrl` / `argocdToken`. **Deprecated.** It's kept for backward-compatibility with deployments that pre-date the `IntegrationCredential` model. New code must not write here; the migration path is "save once via Settings → Integrations and the legacy fields stop being read."
3. **Env fallback** — `ARGOCD_URL` / `ARGOCD_TOKEN`. Useful for single-org deployments and for the integration test suite.

If none of the three resolve, `getArgoCreds` throws `'ArgoCD is not configured…'`. API handlers catch this and surface a 400 with `code: ARGOCD_NOT_CONFIGURED` — the UI's "empty state" pages (see `phase-12-empty-state-pages.sh`) rely on this code to render a friendly "configure ArgoCD" CTA instead of a 500.

The same three-tier resolution (DB credential → legacy settings → env) is implemented for GitHub (`integration-credentials.ts:getGitHubCredentials`) and Grafana (`integration-credentials.ts:getGrafanaCredentials`).

## Grafana embedding

Grafana is a special case: the entire Grafana SPA is reverse-proxied at `/grafana/*` rather than fetched per-panel. `src/app/grafana/[...path]/route.ts` (and the rewrite map in `next.config.mjs`) forward the request to the org's configured Grafana, attaching `Authorization: Bearer <apiKey>` server-side. Two consequences worth knowing:

- **Prometheus and Loki are not first-class** in the portal API. Operators wire them as Grafana datasources; the portal does not implement direct PromQL or LogQL endpoints. The Grafana proxy is how you "use" Prometheus and Loki from the portal.
- The proxy exists *only* to attach credentials and enforce per-org isolation. It does not parse Grafana's HTML or rewrite asset URLs beyond what's needed for the SPA to function under a sub-path.

## ArgoCD application discovery

There is no ArgoCD ↔ Cluster join in the database. The portal:

1. Reads applications from each org's configured ArgoCD instance via `listApplications(orgId)`.
2. Reads clusters from the org's `Cluster` table.
3. Does *not* try to match applications to clusters server-side. The UI shows them side-by-side and the user reasons about the mapping (which is fine — ArgoCD's `destination.server` and `destination.name` are already shown in the application detail view).

If you want auto-correlation, the most straightforward extension point is to compare ArgoCD's `destination.server` to a kubeconfig server URL extracted from each cluster — but doing that in `src/app/api/argocd/applications/route.ts` rather than client-side is what would let RLS still scope the join.

## Failure modes worth flagging

- **Stale cached token after credential rotation**: `invalidateTokenCache(authType, config)` is called on each upstream auth failure. If you rotate a Duplo token and then immediately hit a cluster route, the first request fails fast and the second succeeds with a fresh token.
- **Decryption mismatch after `TOKEN_ENCRYPTION_KEY` rotation**: rows encrypted with the old key need to be re-encrypted using the rotation pattern documented in `docs/operations/SECURITY_AND_RELIABILITY.md`. Until they are, those rows fail to decrypt and the route surfaces an error rather than silently returning empty data — the error wording will reference the cluster or integration credential that failed.
- **Forgetting `npm run db:setup-rls` on a fresh DB**: with RLS disabled, missing-org-filter bugs at the application layer become *cross-tenant data exposure*, not just empty results. The script should be part of any deploy pipeline that runs `prisma db push` or `prisma migrate deploy`.

## Roadmap pointers

- **Portal Agent (v0.5+)**: an in-cluster process that opens an outbound mTLS tunnel back to the portal, removing the need for the portal to reach the cluster's API server directly. Three identity postures planned: built-in CA, BYO-CA (cert-manager / Vault PKI / AWS Private CA), and SPIFFE/SPIRE federation. RFC will land as a GitHub Discussion when implementation kicks off.
- **Mutations behind a separate security review (v0.5+)**: scale, restart, exec, and apply are gated at `READWRITE` today and not all are exposed in the UI. Expanding them into a coherent surface is on the roadmap.

## Related reading

- `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md` — overall runtime topology
- `docs/operations/AUTHENTICATION_AND_USERS.md` — how identity flows in (auth/RBAC matrix is in here)
- `docs/operations/SECURITY_AND_RELIABILITY.md` — RLS, encryption, secret management
- `docs/development/STAGING.md` — the staging deploy that exercises this end-to-end
