# MCPX gateway — runs from source via tsx (consistent with the monorepo's
# other services). Build context is the repo root.
#   docker build -f apps/gateway/Dockerfile -t mcpxgg-gateway .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/gateway ./apps/gateway
COPY apps/facilitator/package.json ./apps/facilitator/package.json

RUN pnpm install --frozen-lockfile --filter @mcpxgg/gateway...

EXPOSE 3003
ENV PORT=3003
CMD ["pnpm", "--filter", "@mcpxgg/gateway", "start"]
