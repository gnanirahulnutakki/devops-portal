# =============================================================================
# DevOps Portal - Production Dockerfile
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies (using legacy-peer-deps for React 19 compatibility)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Stage 2: Builder
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy all files
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for build-time env
# NOTE: DATABASE_URL is needed at build time for Prisma generate only.
# NEXTAUTH_SECRET should NOT be baked into the image — pass at runtime instead.
ARG DATABASE_URL
ARG NEXTAUTH_URL

ENV DATABASE_URL=${DATABASE_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy app + node_modules (custom server.ts needs the full tree at runtime —
# standalone output is disabled in next.config.ts since it omits ws/jose/etc.)
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/ws ./src/lib/ws
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/services ./src/lib/services
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/encryption.ts ./src/lib/encryption.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/logger.ts ./src/lib/logger.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# `npm start` runs `tsx server.ts` per package.json — the custom server boots
# Next.js via app.prepare() and adds /api/ws/* WebSocket dispatch on top.
CMD ["npm", "start"]
