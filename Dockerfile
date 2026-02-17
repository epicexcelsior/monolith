FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common ./packages/common
COPY apps/server ./apps/server

# Install everything (need devDeps for esbuild + common package)
RUN pnpm install --filter @monolith/server...

# Bundle server + common into single JS file
RUN cd apps/server && pnpm build

EXPOSE 2567

# Plain node. No tsx. No TypeScript at runtime.
CMD ["node", "apps/server/dist/index.js"]
