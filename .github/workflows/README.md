# GitHub Actions Workflows

This directory now documents workflows for the active root-level Next.js runtime.

It does not describe the older Backstage/plugin or `v2/` workflow layout as the primary path.

## Active Workflow

### `docker-build-push.yml`

This workflow is the main runtime CI and container workflow for the current portal.

It does two things:

1. runs root-runtime quality gates
2. builds the root `Dockerfile` and pushes the image on non-PR runs

### Triggers

- push to `main` or `dev`
- pull requests targeting `main` or `dev`
- manual dispatch with an optional tag override

### Watched Paths

- `src/**`
- `prisma/**`
- `public/**`
- `scripts/**`
- `helm/devops-portal/**`
- root build/config files such as `Dockerfile`, `package.json`, `package-lock.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, and `instrumentation.ts`
- the workflow files themselves

### Quality Gates

The workflow runs, from the repo root:

- `npm ci --legacy-peer-deps`
- `npm run lint`
- `npm run typecheck`
- `npm test -- --run`
- `npm run build`

It injects minimal CI env so the current auth and Prisma setup can build without relying on production secrets:

- `AUTH_MODE=multi`
- `NEXTAUTH_SECRET` and `AUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `REDIS_URL=''`
- `TOKEN_ENCRYPTION_KEY`

### Docker Build

The workflow builds the root [`Dockerfile`](../../Dockerfile).

Tag behavior:

- `main` push: `latest`, short SHA, and date tag
- `dev` push: `dev`, `dev-<sha>`, and `dev-<date>`
- pull request: `pr-<number>`
- manual dispatch: optional custom tag override

### Security Scan

On non-PR runs, the published image is scanned with Trivy and the SARIF report is uploaded to GitHub code scanning.

## Legacy Note

The previous `v2-ci.yml` workflow was removed because the repository no longer has a maintained `v2/` runtime tree. The remaining `v2/` directory content is only a local artifact, not a supported build target.

## Required Secrets

For image push jobs:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Local Parity

If you want to reproduce the quality gates locally, run:

```bash
npm ci --legacy-peer-deps
npm run lint
npm run typecheck
npm test -- --run
npm run build
```
