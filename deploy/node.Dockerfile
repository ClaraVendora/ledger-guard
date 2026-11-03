# Multi-stage build for one workspace package. Build arg PKG = package name, e.g. @lg/ledger-guard
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG PKG
RUN pnpm turbo run build --filter=${PKG}...

FROM build AS runner
ARG PKG
ENV NODE_ENV=production
ENV PKG=${PKG}
CMD ["sh","-c","pnpm --filter $PKG run start:railway"]
