# TBD_PROJECT_NAME Governance

> This document defines how TBD_PROJECT_NAME is governed. It is modeled on the CNCF [project-template](https://github.com/cncf/project-template) Maintainer Council pattern and is designed to be acceptable to the CNCF Technical Oversight Committee at Sandbox application time.

## Principles

1. **Openness.** All decisions are made in public on the project's issue tracker or public discussion forum.
2. **Vendor neutrality.** No single company controls the project roadmap, release cadence, or maintainer lifecycle. Incubation requires maintainers from at least two employers; graduation requires maintainers from at least two employers with demonstrated diversity of contribution.
3. **Meritocracy.** Contributors earn authority through sustained, reviewed contributions — not through corporate affiliation.
4. **Consent.** Controversial decisions require explicit agreement, not silence. Lazy consensus is the default for routine matters; supermajority is required for charter changes.

## Roles

### Contributors
Anyone who submits a PR, issue, design review, test, or documentation fix. Contributors do not have commit rights. Contributors are expected to follow `CODE_OF_CONDUCT.md` and `CONTRIBUTING.md`.

### Reviewers
Contributors with a demonstrated history of quality contributions who have been granted non-binding review authority by a maintainer. Reviewers can approve PRs but cannot merge.

### Maintainers
Maintainers have commit rights and binding review authority. Maintainers are listed in `MAINTAINERS.md`. Maintainers are expected to be responsive on PRs within a reasonable window (aspirationally 5 business days), to uphold project standards, and to participate in governance decisions.

### Maintainer Council
The Maintainer Council is the set of all current maintainers. The Council makes decisions by lazy consensus (no objections within a reasonable window) for routine matters, simple majority for non-charter decisions, and 2/3 supermajority for charter changes.

## Decision process

### Lazy consensus
Most decisions are made by lazy consensus. A proposal is announced on the relevant public channel. If no maintainer objects within 5 business days, the proposal is accepted. Objections must be substantive and specific.

### Simple majority
If lazy consensus fails, a decision can be made by simple majority vote of maintainers. Voting period is 5 business days. Quorum is 50% of maintainers.

### Supermajority for charter changes
The following decisions require 2/3 supermajority of maintainers:
- Amendments to this `GOVERNANCE.md`
- Amendments to `CODE_OF_CONDUCT.md`
- Changes to the project's license
- Changes to the `MAINTAINERS.md` set (addition or removal)
- Changes to the project name or trademark
- Changes to the security disclosure policy in `SECURITY.md`

## Maintainer lifecycle

### Onboarding
A contributor may be nominated to become a maintainer by any existing maintainer. Nomination criteria:
- Sustained contribution history (typically 6+ months of substantive PRs and reviews)
- Demonstrated understanding of the project's scope and design principles
- Adherence to the Code of Conduct
- Willingness to accept review responsibility

Nominations are decided by simple majority vote of existing maintainers, voting period 5 business days.

### Offboarding
A maintainer may be removed by 2/3 supermajority vote. Removal criteria include:
- Sustained inactivity (no substantive activity for 6+ months)
- Violations of the Code of Conduct
- Conflict of interest that cannot be resolved

A maintainer may also voluntarily step down to emeritus status at any time. Emeritus maintainers retain listing recognition but not commit rights.

### Emeritus
Former maintainers are listed in `MAINTAINERS.md` under an "Emeritus" section, in recognition of their historical contribution.

## Scope and non-goals

The scope of this project is explicitly defined in `README.md`. Proposed changes to the scope require charter-change supermajority. Out-of-scope features, even if well-implemented, will not be accepted without a scope change.

## Vendor-neutrality requirements

At CNCF Sandbox application time, the project may have a single-vendor contributor base with a credible path to diversification. At Incubation time, maintainers must be from at least two employers. At Graduation time, maintainers must be from at least two employers with sustained contribution over at least 12 months. These requirements are hard — this document is updated to reflect the vendor-neutrality state at each maturity level, and the Maintainer Council is responsible for ensuring compliance.

## Conflict of interest

Maintainers must disclose any financial, employment, or other conflict of interest that affects their participation in a decision. A maintainer with a conflict must recuse themselves from the binding vote on that decision. The Maintainer Council may, by simple majority, require a recusal if a maintainer does not self-recuse.

## Disputes

Technical disputes are resolved by discussion in public issues. If discussion cannot reach consensus within a reasonable window (typically 2 weeks), the Maintainer Council decides by simple majority. Governance disputes (questions about this document's interpretation) require charter-change supermajority to resolve.

## Changes to this document

This document may be amended only by 2/3 supermajority of the Maintainer Council. Proposed amendments must be announced with at least 10 business days' notice before the vote.

## Attribution

This governance model is adapted from the [CNCF project-template Maintainer Council pattern](https://github.com/cncf/project-template/blob/main/governance/maintainer-council.md). Attribution preserved per CNCF licensing guidance.
