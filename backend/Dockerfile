# Base Stage
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy workspace package files
COPY backend/package.json ./backend/
COPY cli/package.json ./cli/
# Copy Prisma schema for generation
COPY backend/prisma ./backend/prisma/
COPY backend/prisma.config.js ./backend/

# Install dependencies using workspaces
RUN pnpm install --filter backend... --filter .

# Stage 2: Build
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter backend exec prisma generate --schema=./backend/prisma/schema.prisma

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/backend/src ./backend/src
COPY --from=build --chown=nodejs:nodejs /app/backend/prisma ./backend/prisma
COPY --from=build --chown=nodejs:nodejs /app/backend/prisma.config.js ./backend/

USER nodejs

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
