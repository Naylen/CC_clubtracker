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

# pg_dump needed for scheduled database backups to Google Drive
RUN apk add --no-cache postgresql16-client

WORKDIR /app

ENV NODE_ENV=production

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy drizzle-kit, schema, and migrations for runtime migration (instrumentation.ts)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/lib/db/schema ./src/lib/db/schema
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy utility scripts (e.g., backfill-member-numbers)
COPY --from=builder /app/scripts ./scripts

EXPOSE 3001
CMD ["node", "server.js"]
