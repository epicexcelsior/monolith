FROM node:22-slim

# Match exact pnpm version from package.json
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the packages we need
COPY packages/common ./packages/common
COPY apps/server ./apps/server

# Install deps for server + common workspace chain
RUN pnpm install --filter @monolith/server...

EXPOSE 2567

# tsx handles raw TypeScript imports from @monolith/common
CMD ["npx", "tsx", "apps/server/src/index.ts"]
