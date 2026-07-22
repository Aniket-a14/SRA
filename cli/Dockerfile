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
# docker-compose.yml mounts the host project root at /app/workspace so `sra` commands
# (check/sync/push resolve paths like sra.spec.json relative to cwd) scan the user's
# actual project — the container's runtime cwd must match that mount, not the CLI's
# own source tree the earlier WORKDIR was needed for during `pnpm link`.
WORKDIR /app/workspace
ENTRYPOINT ["sra"]
CMD ["--help"]
