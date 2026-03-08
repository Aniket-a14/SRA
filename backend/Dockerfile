# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy workspace package files
COPY backend/package.json ./backend/
COPY cli/package.json ./cli/
# Copy Prisma schema for generation
COPY backend/prisma ./backend/prisma/
COPY backend/prisma.config.js ./backend/

# Install dependencies using workspaces
RUN npm ci --workspace=backend --include-workspace-root

# Stage 2: Build
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN npm install -g prisma
RUN prisma generate --schema=./backend/prisma/schema.prisma

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/package*.json ./
COPY --from=build --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/backend/src ./backend/src
COPY --from=build --chown=nodejs:nodejs /app/backend/prisma ./backend/prisma
COPY --from=build --chown=nodejs:nodejs /app/backend/prisma.config.js ./backend/

USER nodejs

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
