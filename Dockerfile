# syntax=docker/dockerfile:1
# AgencyForge — multi-target image for the monorepo.
#   docker build --target runtime   -t agencyforge-runtime .
#   docker build --target dashboard -t agencyforge-dashboard .

# ── base: workspace manifests + dependencies ─────────────────────────────────
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Toolchain for native modules (better-sqlite3 falls back to compiling when no prebuilt binary matches).
RUN apt-get update \n && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \n && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY kernel/package.json kernel/
COPY memory-engine/package.json memory-engine/
COPY research/package.json research/
COPY runtime/package.json runtime/
COPY website-builder/package.json website-builder/
COPY dashboard/package.json dashboard/
COPY revenue-engine/revenue-engine/package.json revenue-engine/revenue-engine/
RUN pnpm install --frozen-lockfile

# ── build: compile every workspace package ───────────────────────────────────
FROM base AS build
COPY . .
RUN pnpm --filter @agencyforge/runtime... build \
 && pnpm --filter agencyforge-dashboard build

# ── runtime: RuntimeBridge (:3001) + health server (:3002) ───────────────────
FROM build AS runtime
ENV NODE_ENV=production
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3001 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
WORKDIR /app/runtime
CMD ["node", "dist/cli.js"]

# ── dashboard: Next.js UI (:3000) ────────────────────────────────────────────
FROM build AS dashboard
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
WORKDIR /app/dashboard
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
