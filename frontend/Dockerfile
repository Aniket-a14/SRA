# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy workspace package files
COPY frontend/package.json ./frontend/

# Install dependencies using workspaces
RUN npm ci --workspace=frontend --include-workspace-root

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN mkdir -p frontend/public
ENV NEXT_PRIVATE_STANDALONE=true
RUN npm run build --workspace=frontend

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

COPY --from=build /app/frontend/public ./public
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/standalone/frontend ./
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
