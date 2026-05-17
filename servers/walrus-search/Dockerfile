# walrus-search anchor server (S3-T16). Build context is the repo root.
#   docker build -f servers/walrus-search/Dockerfile -t mcpxgg-walrus-search .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY servers/walrus-search ./servers/walrus-search

RUN pnpm install --frozen-lockfile --filter @mcpxgg/walrus-search...

EXPOSE 3010
ENV PORT=3010
CMD ["pnpm", "--filter", "@mcpxgg/walrus-search", "start"]
