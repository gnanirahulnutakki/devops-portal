# Security Policy

## Reporting a vulnerability

**Do not report security vulnerabilities via public GitHub issues.**

If you believe you have found a security vulnerability in TBD_PROJECT_NAME, please report it privately to:

- **Email**: `security@TBD_PROJECT_NAME.dev` *(to be established at name clearance)*
- **GitHub private advisory**: use the repository's "Security" tab → "Report a vulnerability"

Please include as much of the following as possible:

- A description of the issue
- Affected component(s): protocol spec, gateway, agent, adapter, conformance suite
- Affected versions (if known)
- Steps to reproduce
- Proof-of-concept or exploit code, if available
- Suggested mitigation or fix, if any
- Your name and affiliation (for acknowledgment; optional)

## Response process

### Acknowledgment (within 3 business days)
The security response team will acknowledge receipt of your report within **3 business days**. Acknowledgment confirms the report has been received and is being triaged; it is not yet a confirmation of validity.

### Triage (within 14 calendar days)
Within **14 calendar days** of acknowledgment, the security response team will complete initial triage and provide one of:
- Confirmation that the issue is a valid vulnerability, with assigned severity (Critical / High / Medium / Low / Informational)
- Explanation of why the report is not considered a vulnerability
- Request for additional information

### Coordinated disclosure (default 90 days)
The default disclosure window is **90 days** from acknowledgment, unless severity warrants faster release or the reporter requests a different timeline.

For Critical severity issues, the security response team may accelerate disclosure to minimize exposure.

For Low or Informational issues, the window may be extended by mutual agreement if the fix requires architectural changes.

## Severity classification

| Severity | Definition | Example |
|---|---|---|
| **Critical** | Unauthenticated remote code execution, credential leakage, or full privilege escalation | Agent enrollment accepts forged join tokens |
| **High** | Authenticated privilege escalation, agent impersonation, audit tampering | An agent can impersonate another agent via nonce collision |
| **Medium** | Information disclosure of non-credential data, denial of service affecting single tenant | Operation metadata leaked across tenant boundary |
| **Low** | Low-impact information disclosure, non-critical availability issues | Health check endpoint exposes build metadata |
| **Informational** | Hardening recommendations, defense-in-depth improvements | Weak TLS cipher suite in example config |

## Security response team

The security response team is a subset of the Maintainer Council with demonstrated security expertise. Current members are listed in `MAINTAINERS.md` under the "Security Response" section.

At least two maintainers must be on the security response team at all times. If the team drops below two, the Maintainer Council is responsible for adding members within 30 days.

## Embargo and coordinated disclosure

Vulnerability reports are subject to embargo during the triage and fix window. Details are shared only with:
- The security response team
- Maintainers directly involved in developing the fix
- Trusted downstream distributors (at the security response team's discretion, under separate embargo)
- The original reporter

Embargoes end at coordinated disclosure time, when:
- A fix is available and released
- A public advisory is published
- Credit is given to the reporter (unless anonymity was requested)

## Supported versions

At M0, only the `main` branch is supported. Starting at M5 (protocol v1.0 freeze), the project will publish a support matrix for released versions.

## Security best practices for adopters

While the full adopter security guide is a post-v1.0 deliverable, early adopters should:
- Always use mTLS between agent and gateway (non-negotiable — the protocol has no non-mTLS mode)
- Rotate agent certificates at or before 50% of TTL elapsed
- Run the OPA/CEL policy engine at both gateway (central) and agent (local) decision points per DR-002
- Route audit events to an OTLP sink or immutable object store, never to CRDs (DR-004)
- Never disable replay protection (nonce counters)
- Keep join tokens single-use and TTL-bounded
- Enforce a denylist of revoked agent fingerprints at the gateway

## Attribution

This security policy draws on the [CNCF security guidance for new projects](https://contribute.cncf.io/maintainers/security/) and is intended to meet Sandbox acceptance expectations.
