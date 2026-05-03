# Base Stage
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm
WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy workspace package files
COPY frontend/package.json ./frontend/

# Install dependencies using workspaces
RUN pnpm install --filter frontend... --filter .

# Stage 2: Build
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN mkdir -p frontend/public
ENV NEXT_PRIVATE_STANDALONE=true
RUN pnpm --filter frontend run build

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
