# CLAUDE.md — TBD_PROJECT_NAME core/ context for Claude Code

> This file is read at session start by Claude Code when working in `core/`. It captures enough context for a future session to pick up the project without re-reading the entire Notion hub and pair session log.

## Current state (snapshot, update as it changes)

**Last updated**: 2026-04-11 post-MVP
**MVP status**: ✅ compiles and runs end-to-end (gateway + agent + k8s-get-pods adapter + client CLI)
**v0.1 status**: proto drafted (has 5 known issues), reference implementation not yet written
**Branch**: `feature/core-protocol` in worktree at `~/.claude/worktrees/devops-portal-core-protocol`

For the full project narrative, read `PROJECT.md` in this directory.

## Before you touch anything

1. **Read `PROJECT.md` first.** It has the full context — where we are, what's built, what's next, and which decisions are still open.
2. **Check `git status`** in the worktree. Anything uncommitted is in-progress; don't blow it away.
3. **Search the Notion hub** before starting any research that might already be done: https://www.notion.so/33f2637edb0781549ae8cf500379ba4a
4. **Do not touch the main `dev` working tree** at `~/Documents/github/devops-portal`. It has 38 uncommitted WIP files that must not be disturbed.

## Hard rules

| Rule | Why |
|---|---|
| Never push to any git remote without explicit user approval | User's CLAUDE.md says so |
| Never add Claude or claude-code as commit co-author | User's CLAUDE.md says so |
| Never amend an existing commit unless explicitly asked | Risk of losing work |
| Never touch the main working tree's 38 uncommitted files | They belong to a separate in-flight change set |
| Never conflate this project with `EOC-MCP Project` (ARCHITECTURE v3) in Notion | Different product. Earlier session nearly polluted the plan by conflating them. |
| All commits to `feature/core-protocol` must have DCO sign-off (`git commit -s`) | CNCF-grade discipline per `CONTRIBUTING.md` |
| `core/` code must not import from `src/`, `prisma/`, or `app/` | Extraction-readiness discipline (DR-007) |
| Never use the literal string "Claude" in commit messages, PR bodies, or code comments | User's CLAUDE.md says so |

## Soft conventions

- **Naming placeholder**: everywhere uses the literal string `TBD_PROJECT_NAME`. Do not pick a real name until a trademark search clears one. Dead names: `clusterops`, `clusterops-mesh` (ReactiveOps trademark Reg. No. 6015193).
- **Module path**: `github.com/TBD_PROJECT_NAME/core`
- **Go version**: 1.24+ (currently on 1.25.8)
- **MVP stack**: HTTP+JSON, no TLS, no auth, no policy, no audit, no durability. This is deliberate and temporary.
- **v0.1 stack**: gRPC + protobuf, mTLS, OPA/CEL dual placement, OTLP audit, NATS JetStream inbox/outbox. To be written.

## How I work with pair partners on this project

I (Claude Code) orchestrate a team of AI CLIs as parallel implementers. This is a structured pattern, not ad-hoc. Details in the `ai-dev-team` skill at `~/.claude/skills/ai-dev-team/SKILL.md`.

Summary of the team as of 2026-04-11:

| Role | Tool | Notes |
|---|---|---|
| **Head developer** | Claude Code (me) | Architecture, integration, debugging, test-running, head assignment |
| **Backend implementer 1** | codex CLI (`pair-with-codex.sh` wrapper) | Go backend code. Default model `gpt-5.4/xhigh/fast` via `~/.codex/config.toml`. |
| **Backend implementer 2** | cursor-agent (`--model composer-2`) | Fast code generation. Composer is cheap and fast — use for bulk coding. |
| **Heavy reviewer** | cursor-agent (`--model claude-4.6-opus-max-thinking`) | Protocol-level critique, deep thinking. **Expensive — use sparingly.** |
| **Infra/adapter implementer** | gemini CLI (`pair-with-gemini.sh` wrapper) | Good for self-contained file generation (e.g. adapters). Model `gemini-2.0-flash-thinking-exp`. |
| **Alternative reviewer** | cursor-agent (`--model grok-4-20-thinking`) | Independent architectural perspective. |
| **Not usable** | kimi CLI, auggie | No reliable non-interactive mode (verified 2026-04-11) |

See the `ai-dev-team` skill for the full orchestration pattern, role definitions, and operational loop.

## Critical files to know about

| File | Purpose |
|---|---|
| `PROJECT.md` | Full project narrative. Read first. |
| `CLAUDE.md` | This file. Session bootstrap. |
| `README-MVP.md` | How to build and run the MVP. |
| `protocol/action-protocol.proto` | v0.1 gRPC wire spec draft. **Has 5 known issues — do not build against until fixed.** |
| `protocol/mvp/types.go` | MVP shared Go types. Temporary. Replaced in v0.1. |
| `protocol/docs/*.md` | 5 prose spec documents (state machine, identity, policy, audit, upstream-first). |
| `Makefile` | Build and run targets. |
| `go.mod` | Single module: `github.com/TBD_PROJECT_NAME/core` |
| `GOVERNANCE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` | CNCF-grade scaffolding |

## Context I should preserve across sessions

- **B→A path** (DR-010, committed): ship internally, extract to CNCF Sandbox at M6 (~12 months out). This is the strategic commitment. Don't revisit without cause.
- **The 4-reviewer critique** (2026-04-11): codex, cursor-agent, gemini, grok all produced independent reviews of the M0 implementation plan. They surfaced 13 open decisions and many overlapping concerns. Read their critiques before writing v0.1 code.
- **The MVP is a throwaway proof-of-concept.** When v0.1 is ready, the HTTP+JSON path is deleted and replaced with the gRPC implementation.
- **External co-maintainer is a hard blocker for CNCF Incubation.** Start cultivating now (month 1), not at month 11.
- **Trademark `clusterops` is dead** (ReactiveOps Reg. No. 6015193). Never use it.

## Memory notes

If you're a future Claude session reading this, also check:
- `~/.claude/projects/-Users-nutakki/memory/MEMORY.md` for the user's auto-memory index
- The `devops-portal-v2` memory entry
- The `feedback-use-active-repo-not-mirror` memory entry (learned the hard way this session)
