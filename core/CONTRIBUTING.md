# Contributing to TBD_PROJECT_NAME

Thank you for your interest in contributing. This document describes how to propose changes, the review process, and the expectations for contributors.

## Before you start

1. Read the [README.md](./README.md) to understand the project's scope and design constraints.
2. Read the 10 Decision Records (`DR-001` through `DR-010`) listed in the README. They are hard constraints — PRs that conflict with them will not be accepted without a charter-change governance vote.
3. Read the [Code of Conduct](./CODE_OF_CONDUCT.md). All interactions in this project must follow it.
4. Read this document to the end before opening your first PR.

## Developer Certificate of Origin (DCO)

**Every commit must be signed off** with a Developer Certificate of Origin 1.1 line. This is the project's alternative to a CLA.

To sign off a commit, add the `-s` flag:

```
git commit -s -m "protocol: add retry deadline field to OperationRequest"
```

This appends a line like:

```
Signed-off-by: Your Name <your@email.example>
```

Commits without a valid DCO sign-off will be rejected by CI. There are no exceptions.

## Types of contributions

### Protocol changes (`core/protocol/`)
Protocol changes affect the public wire contract. They are the highest-bar contributions:
- Require an issue discussion before the PR
- Require an ADR (Architecture Decision Record) in `core/protocol/docs/`
- Require at least two maintainer approvals
- Must pass the full conformance suite
- Breaking changes require a major version bump (post-v1.0)

### Reference implementation changes (`core/gateway/`, `core/agent/`, `core/adapters/`)
Changes to the reference gateway, agent, or adapters:
- Require an issue discussion for non-trivial changes
- Require at least one maintainer approval
- Must pass existing unit and integration tests
- Must not break conformance

### Documentation and examples
Documentation improvements, example fixes, and typo corrections:
- May be submitted directly as a PR without a prior issue
- Require at least one maintainer approval
- Should include updated links and references where applicable

### Tests
Test additions and improvements are always welcome:
- May be submitted directly as a PR
- Require at least one maintainer approval

## Development workflow

### 1. Fork and clone

```
git clone https://github.com/TBD_PROJECT_NAME/TBD_PROJECT_NAME.git
cd TBD_PROJECT_NAME
```

*(Pre-M6 this project lives inside the Radiant `devops-portal-v2` repo under `core/`. The M6 milestone is the extraction to a standalone repo.)*

### 2. Create a branch

Use a descriptive branch name:

```
git checkout -b proto/add-operation-retry-deadline
```

Branch name prefixes:
- `proto/` for protocol spec changes
- `gateway/` for gateway changes
- `agent/` for agent changes
- `adapter/` for adapter changes
- `docs/` for documentation
- `test/` for test-only changes
- `ci/` for CI and tooling changes

### 3. Make your change

- Follow existing style conventions
- Add or update tests
- Add or update docs
- Sign off every commit with `git commit -s`
- Keep commits focused — one logical change per commit when possible

### 4. Verify locally

Before pushing:

```
# From core/
go test ./...
buf lint
buf format
```

For protocol changes, also run the conformance tests once the conformance suite exists (planned for M1):

```
go test ./conformance/...   # when available
```

### 5. Open a PR

- Link to the relevant issue(s) in the PR description
- Include a clear description of what changed and why
- Include a checklist of affected components
- Mark the PR as draft if it is not yet ready for review

### 6. Review

A maintainer will be assigned within 5 business days (aspirationally — this is not a hard SLO). Review feedback must be addressed before merge. If the PR stalls without response for 14 days, it may be closed; you can reopen it at any time with a comment.

### 7. Merge

Maintainers merge approved PRs using squash-and-merge or rebase-and-merge, at the merging maintainer's discretion. Your original commit authorship and sign-off is preserved.

## Style and quality expectations

### Go code
- `gofmt` + `goimports` clean
- `go vet` clean
- `staticcheck` clean (warnings addressed or explicitly justified)
- Package-level doc comments on all exported types
- Unit tests for all exported functions
- Table-driven tests where the input/output space is enumerable

### Protocol Buffers
- `buf lint` clean
- `buf format` clean
- Field comments mandatory on every field — explain WHY the field exists, not just what it is
- No breaking changes post-v1.0 without a major version bump

### Documentation
- Markdown files use GitHub-flavored Markdown
- Line length is not enforced; readability is
- Links to external resources must be stable (archive.org if unsure)
- Citations preferred over assertions when making claims about CNCF precedents, OCM behavior, etc.

## Testing requirements

- Unit tests for all new or modified Go functions
- Integration tests for any change affecting the gateway/agent stream
- Conformance tests for any protocol-affecting change
- Benchmarks for any change claimed to improve performance

## Filing issues

- Use the issue templates
- Search existing issues before filing a duplicate
- For security issues, see [SECURITY.md](./SECURITY.md) — never file security issues publicly

## Commit message format

```
<component>: <short summary in imperative mood, under 72 chars>

<optional body — what, why, how, limitations>

<optional footer — issue refs, DCO sign-off>
```

Example:

```
protocol: mark OperationState.UNKNOWN as terminal

The previous draft left UNKNOWN as a transient state with no
reconciliation window, which made audit forensics unreliable after
agent crashes. This commit documents UNKNOWN as terminal with a
default 15-minute reconciliation window, configurable per adapter
between 1 and 60 minutes.

Refs #42

Signed-off-by: Jane Doe <jane@example.com>
```

## Attribution

This contributing guide is adapted from CNCF best practices and the [CNCF project-template contributing docs](https://github.com/cncf/project-template). Thanks to the broader CNCF community for these patterns.
