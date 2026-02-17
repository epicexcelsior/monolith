FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the packages we need
COPY packages/common ./packages/common
COPY apps/server ./apps/server

# Install deps (includes tsx via devDependencies)
RUN pnpm install --frozen-lockfile --filter @monolith/server...

EXPOSE 2567

CMD ["npx", "tsx", "apps/server/src/index.ts"]
