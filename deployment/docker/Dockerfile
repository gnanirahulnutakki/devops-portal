# Backstage GitOps Portal - Production Docker Image
# Based on official Backstage multi-stage build pattern
# https://backstage.io/docs/deployment/docker/

# Stage 1 - Create yarn install skeleton layer
FROM node:22-bookworm-slim AS packages

WORKDIR /app
COPY package.json yarn.lock ./

# Copy all workspace package.json files (for dependency resolution)
COPY packages/backend/package.json ./packages/backend/
COPY packages/app/package.json ./packages/app/
COPY plugins/gitops/package.json ./plugins/gitops/
COPY plugins/gitops-backend/package.json ./plugins/gitops-backend/

# Stage 2 - Install dependencies and build packages
FROM node:22-bookworm-slim AS build

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    libsqlite3-dev \
    python3 \
    g++ \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create cache directory for nobody user
RUN mkdir -p /tmp/.yarn-cache && chmod 777 /tmp/.yarn-cache

USER nobody
WORKDIR /app

# Copy package.json files from packages stage
COPY --from=packages --chown=nobody:nogroup /app ./

# Install ALL dependencies (including devDependencies needed for build)
# Note: Not using --frozen-lockfile to allow yarn to update lockfile if needed
RUN --mount=type=cache,target=/tmp/.yarn-cache,sharing=locked,uid=65534,gid=65534 \
    yarn install --cache-folder /tmp/.yarn-cache

# Copy full source code
COPY --chown=nobody:nogroup . .

# Build the backend and frontend
# Note: Skipping global 'yarn tsc' as workspaces compile their own TypeScript
RUN yarn workspace backend build
RUN yarn workspace app build

# Create skeleton and bundle tarballs for production stage
RUN mkdir -p packages/backend/dist/skeleton packages/backend/dist/bundle && \
    tar xzf packages/backend/dist/skeleton.tar.gz -C packages/backend/dist/skeleton && \
    tar xzf packages/backend/dist/bundle.tar.gz -C packages/backend/dist/bundle

# Stage 3 - Build the production image
FROM node:22-bookworm-slim

# Install runtime dependencies including Python for node-gyp
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    libsqlite3-dev \
    python3 \
    build-essential \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Create cache directory for nobody user
RUN mkdir -p /tmp/.yarn-cache && chmod 777 /tmp/.yarn-cache

USER nobody
WORKDIR /app

# Copy skeleton (package.json files) for production install
COPY --from=build --chown=nobody:nogroup /app/yarn.lock /app/package.json ./
COPY --from=build --chown=nobody:nogroup /app/packages/backend/dist/skeleton/ ./

# Install ONLY production dependencies
# Note: Not using --frozen-lockfile to allow yarn to update lockfile if needed
RUN --mount=type=cache,target=/tmp/.yarn-cache,sharing=locked,uid=65534,gid=65534 \
    yarn install --production --cache-folder /tmp/.yarn-cache

# Copy built backend bundle
COPY --from=build --chown=nobody:nogroup /app/packages/backend/dist/bundle/ ./

# Copy frontend dist (served by backend)
COPY --from=build --chown=nobody:nogroup /app/packages/app/dist ./packages/app/dist

# Copy configuration files
COPY --chown=nobody:nogroup app-config.yaml ./
COPY --chown=nobody:nogroup app-config.production.yaml* ./

# Copy documentation (for techdocs)
COPY --chown=nobody:nogroup docs ./docs

# Set production environment
ENV NODE_ENV=production
ENV PORT=7007

# Expose backend port
EXPOSE 7007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7007/healthcheck || exit 1

# Use tini as init system to handle signals properly
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the backend
CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
