# Security Policy

## Supported versions

Pre-1.0. Security fixes are applied to `main` and the latest minor release branch (currently none — `main` is the only supported tree until a `v0.x` branch is cut).

| Version | Supported |
|---|---|
| `main` | ✅ |
| `< main` | ❌ — no LTS commitments yet |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use either of these private channels:

1. **Preferred — GitHub Security Advisories**: open a private advisory at <https://github.com/gnanirahulnutakki/devops-portal/security/advisories/new>. This is the fastest path; it doesn't require an email exchange and gives you a direct conversation with maintainers.

2. **Email**: report to `gnanirn@gmail.com` with `[devops-portal security]` in the subject. Encrypt sensitive details with the maintainer's GPG key (request the key by sending a non-sensitive email first).

### What to include

- Affected component and version (commit SHA if from `main`).
- Steps to reproduce.
- Impact assessment (what an attacker can do).
- Suggested fix or mitigation if known.
- Whether you've published or shared the report elsewhere.

### What to expect

- **Acknowledgement**: within 72 hours.
- **Initial triage**: within 7 days. Severity assignment per [CVSS 3.1](https://www.first.org/cvss/calculator/3.1) where applicable.
- **Fix timeline**: depends on severity:
  - **Critical** (RCE, auth bypass, mass data exposure): aim for a patch within 14 days.
  - **High** (privilege escalation, individual data exposure): aim for a patch within 30 days.
  - **Medium / Low**: addressed in the next regular release cycle.
- **Disclosure**: coordinated. We'll publish a GitHub Security Advisory + CVE (if applicable) when a patched release is available. You'll be credited unless you prefer to remain anonymous.

### Safe-harbor

Good-faith vulnerability research conducted under this policy is welcomed. We will not pursue legal action against researchers who:

- Work only against test instances they control (don't probe other operators' deployments without their explicit permission).
- Don't intentionally degrade availability for others.
- Don't access, modify, or exfiltrate data beyond what's needed to demonstrate the vulnerability.
- Disclose privately to us first and give us reasonable time to fix before public disclosure.

## Threat model summary

A formal threat model will be published with the v0.5 Portal Agent release (the current release is kubeconfig-federation only — central calls the K8s API directly using stored credentials; threat model concerns are limited to the central process and its database).

In-scope adversaries:
- Network attackers (passive + active MITM)
- Compromised user accounts on central
- Compromised dependencies (supply-chain)
- Curious operators of one tenant trying to read another tenant's data

Out-of-scope (documented limitations):
- Compromised customer K8s API server in agent mode (if the cluster is owned, the agent is moot)
- Compromised host OS where the central is deployed
- Side-channel attacks (timing, cache, power) — defended only at the cryptographic-primitive level

## Security best-practice for operators

If you're running this:

- **Generate fresh secrets** at install time. Don't ship with example values.
  - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
  - `TOKEN_ENCRYPTION_KEY` — `openssl rand -base64 32`
- **Rotate `TOKEN_ENCRYPTION_KEY` periodically** by adding `TOKEN_ENCRYPTION_KEY_2`, `_3`, etc. (the key ring supports rotation; existing data decrypts via the older key id).
- **Disable `ENABLE_CREDENTIALS_AUTH=false`** for production — use SSO (Keycloak, GitHub, Azure, Google).
- **Run behind TLS termination** (reverse proxy or ingress with valid certs). Don't expose port 3000 directly.
- **Scope cluster kubeconfigs to read-only** if possible — most of the portal's value is read-only, and limiting RBAC reduces blast radius if central is compromised.
- **Watch the audit log** at `agent_audit` and `audit_logs` tables for unexpected access patterns.
- **Apply security updates promptly** — pre-1.0 means breaking changes can land in patch releases until a stable branch is cut.

## Cryptographic implementation

- **Token encryption at rest**: AES-256-GCM with PBKDF2-HMAC-SHA256 key derivation (100k iterations from env var, 10k iterations per-message with random salt). Key ring supports rotation. See [`src/lib/encryption.ts`](src/lib/encryption.ts).
- **Password hashing**: bcrypt with configurable rounds (default 12). See [`src/lib/auth.ts`](src/lib/auth.ts).
- **Session signing**: NextAuth v5 default (HS256 with `NEXTAUTH_SECRET`).
- **TLS to integrations**: Node.js native `tls` module. `tlsVerify: false` is opt-in per integration but emits a warning every restart.

Audited test suite for encryption (real round-trip, no mocks): [`src/lib/__tests__/encryption.test.ts`](src/lib/__tests__/encryption.test.ts).

## Known limitations

- **Output sanitization is best-effort, not a security boundary.** Pod logs, K8s Events, and resource YAML can leak secrets that operators put in env vars or ConfigMaps. We redact common patterns (JWTs, AWS keys, GitHub PATs, PEM blocks, kubeconfig lines), but cannot redact arbitrary application secrets. Operators should apply their own redaction at the source.
- **Pre-1.0 means no LTS branches yet.** Security fixes only reliably reach `main`.
- **Multi-cluster mutations are not yet implemented.** When they ship in v0.5, they'll require a separate threat-model review and audit-log integration.

## Acknowledgements

Security findings credited here as they're fixed.
