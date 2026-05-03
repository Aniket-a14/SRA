# Base Stage
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm
WORKDIR /app

# Stage 1: Build
FROM base AS builder

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy workspace package files
COPY cli/package.json ./cli/

# Install dependencies using workspaces
RUN pnpm install --filter @sra-srs/sra-cli... --filter .

# Copy CLI source
COPY cli ./cli

# Stage 2: Runtime
FROM base AS runtime
COPY --from=builder /app /app
WORKDIR /app/cli
RUN pnpm link --global
ENTRYPOINT ["sra"]
CMD ["--help"]
