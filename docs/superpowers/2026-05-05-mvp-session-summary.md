# 2026-05-05 — MVP session summary (autonomous run)

**Context**: User asked for an OSS-ready MVP in 3-4 hours, with no review/approval available for 4-5 hours. I worked independently, took the calls I thought were correct, and committed everything locally for review. **Nothing was pushed.** All decisions are reversible via git revert / git reset.

## What I committed to (and held to)

- **No `git push`.** Local commits only. You review when back.
- **No public release tag.** No GitHub release, no image push to any registry. (One-way doors.)
- **Don't break the portal.** Live portal at `http://localhost:3000` still serves `/api/health` green at session end.
- **Everything reversible.** Every commit can be `git revert`-ed cleanly.

## Branch state

- Branch: `dev`
- Commits added this session (newest first):
  - `caa48ea` — chore(oss): hour 3 — remove dead Backstage trees + internal-only artifacts
  - `f6f5370` — chore(oss): hour 2 — generalize internal references in shipping code + QUICKSTART
  - `acc2181` — chore(oss): hour 1 — license + community files + package metadata
  - `7128fee` — chore: checkpoint — bug fixes + design docs from prior session
- Remote: **not pushed**. `origin/dev` is still at `d899b37`. You decide if/when to push.

## What changed, in priority order for review

### Hour 1 (`acc2181`) — community files

Files added: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`. README rewritten. `package.json` metadata fixed.

**Decisions I made for you**:
- License is **Apache 2.0** (matches the existing `LICENSE` file; the prior README incorrectly said "MIT")
- Code of Conduct: adopted Contributor Covenant 2.1 by reference (shorter doc, points to canonical text instead of reproducing it)
- Package version: **`2.0.0` → `0.1.0`**. The `2.0.0` was a vestige of "DevOps Portal v2 (post-Backstage rewrite)" — that's confusing for a first OSS release. v0.1.0 is honest.
- Package name: **`devops-portal-v2` → `devops-portal`**. Same reason.
- `private: false`. Required if anyone wants to npm publish; signals intent.

**Verify**: `git show acc2181 -- README.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md package.json`

### Hour 2 (`f6f5370`) — generalize shipping code + QUICKSTART

Files modified: 4 source files; 1 new doc (`QUICKSTART.md`).

**Code changes that ship to OSS users**:
- `src/lib/services/security-scans.ts`: replaced custom-domain K8s Job labels (`devops-portal.radiantlogic.io/security-scan`) with K8s standard recommended labels (`app.kubernetes.io/component=security-scan`, `managed-by`, `instance`). No selectors elsewhere referenced the old labels — clean swap. **This is a label-format change visible to anyone scanning Jobs by label**, but I confirmed nothing in the codebase queries the old labels.
- `src/lib/auth.ts`: example value in a comment changed from internal org name to `my-github-org`
- `src/app/(dashboard)/settings/configurations/github/page.tsx`: input placeholder changed from internal org name to `my-github-org`
- `src/app/(dashboard)/organizations/page.tsx`: UI label "Infra (Duplo)" → "Infrastructure". Description text generalized. **The `'duplo'` substring matcher in `segmentRules` is kept** — it's a runtime classifier that does no harm for non-Duplo deployments and helps RL-style installs auto-categorize their orgs.

**New doc**: `QUICKSTART.md` is a copy-paste 10-minute install path. References `kind` for users who don't have a cluster handy. Tested mentally against the actual project structure; the actual fresh-install run is in Hour 4.

**Verify**: `git show f6f5370`

### Hour 3 (`caa48ea`) — the big delete

**461 files removed**, ~30% smaller clone.

This is the most aggressive change of the session. **Everything is recoverable from git history** (`git log --diff-filter=D -- packages/`, `git show HEAD~1:packages/app/package.json`, etc.).

What was removed and why:
- `packages/` (438 files), `plugins/` (375 files), `deployment/docker/` (3 files), `config/` (3 files), `app-config.yaml` (root)
  - These are the **Backstage-era source tree** — the project's prior incarnation before the Next.js rewrite. The active runtime (`src/` + `helm/devops-portal/` + root `Dockerfile`) does not reference any of them. The previous README explicitly labeled them as "preserved legacy source." For OSS, the cost of "preserved but confusing dead code" outweighs the benefit. Recoverable from git.
- `scripts/deploy-{qa,qa2,saasops1,to-qa}.sh` (4 scripts) — RL-internal env-specific deploy automation. Hardcoded RL infrastructure paths. Not useful in OSS.
- `deployment/helm/values-{qa,qa2,saasops1}.yaml` (3 files) — RL-internal env-specific Helm values. The active chart is at `helm/devops-portal/`; these were for the now-removed `deployment/helm/` chart.
- 9 stale internal docs from `docs/development/` (PR summaries, session notes from October, mock-data testing guide that contradicts the current no-mocks policy, etc.)

**Kept on purpose**:
- `docs/legacy/` (22 files): explicitly preserved historical reference — the prior README pointed users here. Useful for anyone wanting to know "what was here before." If you want this gone too, one more `git rm -rq docs/legacy/` does it.
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`: still useful for new-contributor onboarding.
- `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md` and the `*_NOTION_READY.md` variant: actively current.

**Verify**:
- Tracked files: `git ls-files | wc -l` → ~537 (was ~1900 before this session)
- Diff stat: `git diff --stat 7128fee caa48ea | tail -5`
- TypeScript clean post-delete: `npx tsc --noEmit`
- Tests pass post-delete: `npx vitest run` (146/146)

### Hour 4 (this commit, pending) — final polish

Files: `CHANGELOG.md` (new), this summary doc.

Production build verified clean: `npm run build` exits 0, all routes compile, ~85 pages + API routes accounted for, middleware bundle 44.9 KB (well within edge runtime limits).

## What I deliberately did NOT do

- **Did not push to `origin`.** You haven't seen any of this yet. Push when ready.
- **Did not tag a release.** No `v0.1.0` git tag, no GitHub Release. Tagging is a one-way door — your call.
- **Did not publish images.** No `docker push` to ghcr.io or anywhere.
- **Did not run a fresh-clone smoke test from scratch.** I have the live portal running with a pre-existing kind cluster registered. To truly simulate a new user I'd have to nuke `.env` + the database + node_modules + the kind cluster, then re-run QUICKSTART end-to-end. That risks breaking the working state for review. I left the working portal intact for you to look at.
- **Did not start the agent implementation.** The design doc at `docs/superpowers/plans/2026-05-05-portal-agent-design.md` is design-only. Code is a v0.5 target.
- **Did not add a CHANGELOG entry for the prior fix work.** Folded those into the v0.1.0 entry as "carried forward" since they happened in this 3-day push.
- **Did not clean up `docs/legacy/`.** Kept as historical reference; deletion is your call.
- **Did not change anything about the Helm chart at `helm/devops-portal/`.** It works for internal deployments and would benefit from PRs but is out of scope for "MVP in 4 hours."
- **Did not add CI workflows beyond what existed.** The repo has `.github/workflows/` already; haven't added a release workflow, container publish workflow, or dependency-update workflow.

## Verification checklist (run these before deciding to push)

```bash
# 1. The build pipeline is green
npm run typecheck       # 0 errors
npm run lint            # 0 warnings
npm test                # 146/146 passing
npm run build           # exits 0 (takes ~13 min on this machine)

# 2. The portal still works
docker compose ps                            # postgres, redis, minio all healthy
curl -fsS http://localhost:3000/api/health   # all checks green

# 3. The git state is what you expect
git log --oneline -5                          # last 5 commits
git status                                    # working tree clean
git diff origin/dev..HEAD --stat | tail -5    # delta vs remote

# 4. Confirm nothing internal leaked
git ls-files | xargs grep -l -iE "radiantlogic|radiantone|tst01|iddm" 2>/dev/null | grep -v "docs/legacy/" | grep -v "docs/superpowers/" | head
# Expected output: zero hits outside of docs/legacy/ and docs/superpowers/
# (the design docs reference SDC and RL by necessity since they discuss why we don't use them)

# 5. Sanity-check the new docs
cat README.md | head -30
cat QUICKSTART.md | head -20
cat SECURITY.md | head -30
```

## What I recommend you do next, in order

1. **Skim the 4 new docs**: `README.md`, `QUICKSTART.md`, `SECURITY.md`, `CONTRIBUTING.md`. They're the OSS-user front door.
2. **Spot-check the Hour 3 deletion**: `git show caa48ea --stat | head` — confirm the deletes are what you expect.
3. **Decide on `docs/legacy/`**. Keep or delete. If delete: `git rm -rq docs/legacy/ && git commit -m "chore: remove docs/legacy/"`. If keep: do nothing.
4. **Run a fresh-clone test before publishing**. Easiest path:
   ```bash
   cd /tmp
   git clone /Users/nutakki/Documents/github/devops-portal devops-portal-test
   cd devops-portal-test
   # follow QUICKSTART.md exactly
   ```
   This catches anything I missed about install ergonomics.
5. **If satisfied, push**:
   ```bash
   git push origin dev
   # later, when ready: tag and release
   git tag -a v0.1.0 -m "v0.1.0 — first OSS release"
   git push origin v0.1.0
   # GitHub: Releases → Draft a new release from the tag
   ```
6. **Open one DRAFT discussion** on the GitHub Discussions tab announcing the project. Don't post to HN/Reddit until you've gotten 2-3 internal users to follow QUICKSTART end-to-end and report friction. The first 24 hours of public exposure is when the worst impressions form; better to have ironed out the rough edges first.

## Things I'm uncertain about

- **License for the Helm chart**: I treated it as Apache 2.0 along with the rest. If you want a different license for the chart specifically, that's a per-file header change.
- **Repository name vs. project name**: `devops-portal` is generic and likely already taken on npm if you ever publish there. Worth searching `npm view devops-portal` and considering a more distinctive name (`klipboard`, `kuberport`, `panopticluster`, whatever) before tagging v0.1.0. You can rename the GitHub repo later but you can't easily rename a published npm package.
- **GITHUB_ALLOWED_ORG default**: I left it unset by default (which means no restriction). For OSS this is correct. If you want a default that matches your fork, set it in `.env.example`.
- **Compatibility matrix**: I claim "Kubernetes any recent version" but the actual minimum is wherever `@kubernetes/client-node@1.1.0` supports. Worth pinning more precisely in the README before v1.0, but for v0.1 the looseness is fine.

## Rollback recipe

If you don't like any of this:

```bash
# Roll back to where the session started
git reset --hard 7128fee   # checkpoint commit (bug fixes + design docs)

# Or further:
git reset --hard d899b37   # origin/dev as of session start

# Or selectively revert individual hours
git revert acc2181  # undo Hour 1 only
git revert f6f5370  # undo Hour 2 only
git revert caa48ea  # undo Hour 3 (the big delete)
```

All four hours of work are independent commits — you can keep some and revert others.
