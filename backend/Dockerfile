# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/package*.json ./
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/src ./src
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma

USER nodejs

EXPOSE 3000

CMD ["node", "src/server.js"]
