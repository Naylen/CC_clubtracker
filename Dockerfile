FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source
COPY . .

# Development
FROM base AS dev
EXPOSE 3001
CMD ["pnpm", "dev", "--port", "3001"]

# Build
FROM base AS builder
# Provide dummy secrets for build-time only (Better Auth validates at module load)
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV BETTER_AUTH_URL=http://localhost:3001
RUN pnpm build

# Production
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["node", "server.js"]
