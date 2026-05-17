# sui-analytics anchor server (S5-T04). Build context is the repo root.
#   docker build -f servers/sui-analytics/Dockerfile -t mcpxgg-sui-analytics .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY servers/sui-analytics ./servers/sui-analytics

RUN pnpm install --frozen-lockfile --filter @mcpxgg/sui-analytics...

EXPOSE 3012
ENV PORT=3012
CMD ["pnpm", "--filter", "@mcpxgg/sui-analytics", "start"]
