# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy workspace package files
COPY cli/package.json ./cli/

# Install dependencies using workspaces
RUN pnpm install --filter @sra-srs/sra-cli... --filter .

# Copy CLI source
COPY cli ./cli

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
# Install pnpm for linking
RUN npm install -g pnpm
COPY --from=builder /app /app
WORKDIR /app/cli
RUN pnpm link --global
ENTRYPOINT ["sra"]
CMD ["--help"]
