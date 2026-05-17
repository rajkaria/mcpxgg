# sui-defi-data anchor server (S5-T01). Build context is the repo root.
#   docker build -f servers/sui-defi-data/Dockerfile -t mcpxgg-sui-defi-data .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY servers/sui-defi-data ./servers/sui-defi-data

RUN pnpm install --frozen-lockfile --filter @mcpxgg/sui-defi-data...

EXPOSE 3011
ENV PORT=3011
CMD ["pnpm", "--filter", "@mcpxgg/sui-defi-data", "start"]
