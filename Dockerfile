FROM node:22-bookworm-slim AS build

RUN apt-get update \
    && apt-get install --no-install-recommends -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY client/package.json ./client/package.json
RUN pnpm install --frozen-lockfile
COPY backend ./backend
COPY client ./client
RUN pnpm build

FROM build AS production-dependencies
RUN pnpm --filter zlog-backend deploy --prod --legacy /app/deploy/backend
RUN mkdir -p /app/data && chown 1000:1000 /app/data

FROM gcr.io/distroless/nodejs22-debian13:nonroot

ENV NODE_ENV=production \
    PORT=3000 \
    ZLOG_DATA_DIR=/app/data

WORKDIR /app/backend
COPY --from=production-dependencies --chown=1000:1000 /app/deploy/backend/node_modules ./node_modules
COPY --chown=1000:1000 backend/package.json ./
COPY --from=build --chown=1000:1000 /app/backend/dist ./
COPY --from=production-dependencies --chown=1000:1000 /app/data /app/data

USER 1000:1000
EXPOSE 3000
CMD ["src/server.js"]
