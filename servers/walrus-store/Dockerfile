# walrus-store anchor server (S6-T09). Build context is the repo root.
#   docker build -f servers/walrus-store/Dockerfile -t mcpxgg-walrus-store .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY servers/walrus-store ./servers/walrus-store

RUN pnpm install --frozen-lockfile --filter @mcpxgg/walrus-store...

EXPOSE 3013
ENV PORT=3013
CMD ["pnpm", "--filter", "@mcpxgg/walrus-store", "start"]
