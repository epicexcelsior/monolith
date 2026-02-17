FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common ./packages/common
COPY apps/server ./apps/server

RUN pnpm install --filter @monolith/server...

EXPOSE 2567

CMD ["node_modules/.bin/tsx", "apps/server/src/index.ts"]
