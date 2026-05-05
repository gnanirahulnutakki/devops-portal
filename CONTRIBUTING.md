# Contributing to DevOps Portal

Thanks for your interest! This is a community-driven, Apache-2.0 OSS project. Contributions in any form — bug reports, docs, tests, code — are welcomed.

## Quick links

- **Code of Conduct**: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- **Security disclosure**: [`SECURITY.md`](SECURITY.md) (do not open public issues for vulnerabilities)
- **Architecture**: [`docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`](docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md)
- **Roadmap**: see [`README.md`](README.md#roadmap)

## Reporting bugs

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Minimal reproduction steps
- Your environment (OS, Node version, K8s version if cluster-related)
- Relevant log output (with secrets redacted!)

Bugs that block adoption are highest priority. If you're trying to install for the first time and something doesn't work, please report it — that's the most valuable feedback at this stage.

## Suggesting features

Open a GitHub Discussion (preferred) or Issue. Describe:

- The problem you're trying to solve
- The current workaround (if any)
- Why this is the right place to solve it (vs. a separate tool)
- Sketch of the proposed solution

For substantial features, expect a design-doc step before implementation. Open a GitHub Discussion with a draft and iterate there before code lands.

## Submitting code

### Setup

```bash
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal
npm install
docker compose up -d postgres redis minio minio-init
cp .env.example .env
# generate secrets — see README "Quick start"
npm run db:push && npm run db:setup-rls && npm run db:seed
npm run dev
```

### Development workflow

1. Fork the repo and create a topic branch (`feat/foo`, `fix/bar`, `docs/baz`).
2. Make focused changes — one feature or bugfix per PR.
3. Add or update tests (see [Testing policy](#testing-policy)).
4. Run the full quality gate locally:
   ```bash
   npm run typecheck   # 0 errors
   npm run lint        # 0 warnings (--max-warnings 0)
   npm test            # all green
   ```
5. Commit with a clear message — see [Commit style](#commit-style).
6. Push and open a PR. The PR description should explain *why*, not just *what*.

### Testing policy — no mocks

This project deliberately does not mock its own modules in tests. All tests run against real services (Postgres, Redis, MinIO via the docker-compose stack, real K8s API for cluster tests).

Rationale: too many bugs hide behind mocks that pretend an API behaves a way it doesn't. Specifically:

- The `@kubernetes/client-node` v0.x → v1 API change broke 5 cluster routes silently in this repo. Mocked tests would have happily passed; real-API tests caught it immediately.
- An `encryption.test.ts` we inherited mocked the `crypto` module — tests passed but exercised zero of the actual encryption code.

Mock-equivalent functionality (silent loggers, deterministic RNG for tests) is implemented via real-mode configuration:

- `LOG_LEVEL=silent` in `src/test/setup.ts` silences pino without faking it
- For randomness in test environments, prefer fixing the seed at the call site

If you genuinely need a mock for a specific test (e.g. simulating a network failure that's hard to reproduce against real services), open a discussion before adding it.

### Commit style

Conventional Commits-ish, but not strict:

```
<type>: <one-line summary, imperative, lowercase>

<optional body, wrapped at ~72 chars, explains why>

<optional footer with breaking-change notes, refs, etc.>
```

Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`.

Example:
```
fix(clusters): pods route now passes namespace via options object

@kubernetes/client-node v1 changed listNamespacedPod from positional
args to an options object. The previous code silently failed at runtime
because the (api as any) cast hid the type error.

Added integration test against kind cluster to prevent regression.
```

### PR review

- A maintainer will review within ~5 business days. Smaller PRs land faster.
- Review focuses on: correctness, security implications, fit with existing patterns, test coverage.
- We use [CodeRabbit](https://www.coderabbit.ai/) and our own `/ai-dev-team` workflow for additional review passes on substantial changes.
- Sign-offs aren't required (no CLA). Apache 2.0 license is implied by submission.

### Style

- TypeScript strict mode. Don't disable rules without comment + reason.
- ESLint with `--max-warnings 0`. Fix warnings; don't suppress.
- Tailwind via shadcn/ui components. Don't introduce another UI library.
- Server / client split: respect Next.js App Router boundaries (no leaking secrets to client).
- Logging: use `pino` (`@/lib/logger`), not `console.log`.
- Database: use Prisma. Raw SQL only when necessary; document why.
- Multi-tenant boundary: every API route handling tenant data must use `withTenantApiHandler` from `@/lib/api`. RLS is the second layer; Prisma queries are the first.

### Security

- No `dangerously*` React props on user-controlled data.
- No hand-built SQL with user input — use Prisma's parameterized queries.
- Secrets via env vars, not committed to the repo.
- New API routes that accept user input → Zod schema validation in `src/lib/validations/schemas.ts`.
- Anything cryptographic → review with maintainers before landing.

## Adding a new platform integration / adapter

The portal currently integrates with K8s, ArgoCD, Prometheus, Grafana, Loki, and a few others. Adding a new integration follows this pattern:

1. **Backend service** under `src/lib/services/<integration>.ts` that wraps the third-party API.
2. **API route** under `src/app/api/<integration>/...` exposing the operations to the frontend.
3. **Page** under `src/app/(dashboard)/<integration>/...` for the UI.
4. **Sidebar entry** in `src/components/dashboard/sidebar.tsx`.
5. **Feature flag** in `src/lib/features.ts` so operators can disable it.
6. **Tests** for the service + API route.
7. **Docs** in `README.md` (the integrations section).

If the integration needs per-cluster credentials (most do), use the `IntegrationCredential` model — see existing implementations.

## Releasing

(Maintainers only — documented for transparency)

1. Run `npm test`, `npm run lint`, `npm run build` — all must pass.
2. Update `package.json` version and `CHANGELOG.md`.
3. Tag the release: `git tag v0.X.Y && git push --tags`.
4. GitHub Actions builds and publishes the container image.
5. Publish a GitHub Release with notes.

Pre-1.0: minor version bumps may include breaking changes. Patch bumps are bug-fix-only.

## License

By contributing, you agree your contributions are licensed under [Apache License 2.0](LICENSE) — same as the project. No CLA required.

## Questions?

Open a GitHub Discussion. We don't bite.
