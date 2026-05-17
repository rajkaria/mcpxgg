# sui-identity anchor server (S6-T11). Build context is the repo root.
#   docker build -f servers/sui-identity/Dockerfile -t mcpxgg-sui-identity .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY servers/sui-identity ./servers/sui-identity

RUN pnpm install --frozen-lockfile --filter @mcpxgg/sui-identity...

EXPOSE 3014
ENV PORT=3014
CMD ["pnpm", "--filter", "@mcpxgg/sui-identity", "start"]
