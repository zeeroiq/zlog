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
RUN pnpm install --prod --frozen-lockfile --filter zlog-backend

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    ZLOG_DATA_DIR=/app/data

WORKDIR /app/backend
COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=production-dependencies --chown=node:node /app/backend/node_modules /app/backend/node_modules
COPY --chown=node:node backend/package.json ./
COPY --from=build --chown=node:node /app/backend/dist ./
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
