FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Install tsx globally so it's always on PATH
RUN npm install -g tsx

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common ./packages/common
COPY apps/server ./apps/server

RUN pnpm install --filter @monolith/server...

EXPOSE 2567

CMD ["tsx", "apps/server/src/index.ts"]
