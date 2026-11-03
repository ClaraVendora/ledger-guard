# Next.js app in the workspace. Build arg PKG = package name, e.g. @lg/dashboard; DIR = apps/dashboard
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
ARG NEXT_PUBLIC_MERCHANT_API_URL
ARG NEXT_PUBLIC_LEDGER_GUARD_URL
ARG NEXT_PUBLIC_MAILBOX_URL
ARG NEXT_PUBLIC_STORE_ID
ENV NEXT_PUBLIC_MERCHANT_API_URL=$NEXT_PUBLIC_MERCHANT_API_URL
ENV NEXT_PUBLIC_LEDGER_GUARD_URL=$NEXT_PUBLIC_LEDGER_GUARD_URL
ENV NEXT_PUBLIC_MAILBOX_URL=$NEXT_PUBLIC_MAILBOX_URL
ENV NEXT_PUBLIC_STORE_ID=$NEXT_PUBLIC_STORE_ID
RUN pnpm turbo run build --filter=${PKG}...

FROM node:22-alpine AS runner
ARG DIR
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/${DIR}/.next/standalone ./
COPY --from=build /app/${DIR}/.next/static ./${DIR}/.next/static
COPY --from=build /app/${DIR}/public ./${DIR}/public
ENV DIR=${DIR}
CMD ["sh","-c","node $DIR/server.js"]
