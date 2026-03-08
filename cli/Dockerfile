# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy workspace package files
COPY cli/package.json ./cli/

# Install dependencies using workspaces
RUN npm install --workspace=@sra-srs/sra-cli --include-workspace-root

# Copy CLI source
COPY cli ./cli

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app /app
WORKDIR /app/cli
RUN npm link
ENTRYPOINT ["sra"]
CMD ["--help"]
