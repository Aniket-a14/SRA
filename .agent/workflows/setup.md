---
description: Set up the SRA project for local development
---

Follow these steps to set up the SRA project in your local development environment:

1. **Install Prerequisites**:
   - Ensure **Node.js >= 20.19.0** is installed (governed by monorepo engine requirements).
   - Ensure **pnpm** (preferred package manager) is installed:
     ```bash
     npm install -g pnpm
     ```

2. **Initialize Monorepo Dependencies**:
   - Navigate to the monorepo root directory and run the standard install:
     ```bash
     pnpm install
     ```
     *This will configure, resolve, and link all workspace dependencies across backend, frontend, model, cli, and terraform.*

3. **Configure Environment Variables**:
   - Create a `.env` file in the `backend/` directory based on `.env.example`.
   - Create a `.env.local` file in the `frontend/` directory based on `.env.example`.
   - Ensure `DATABASE_URL` (pooled connection on port `6543`) and `DIRECT_URL` (direct unpooled on port `5432`) are properly specified for Prisma.

4. **Database Setup**:
   - Ensure PostgreSQL is running.
   - Run Prisma migrations from the monorepo root:
     ```bash
     pnpm --filter backend exec prisma migrate dev
     ```

5. **Start Development Servers**:
   - Start the backend and frontend concurrently using the root workspace commands:
     - In the monorepo root, start the backend:
       ```bash
       pnpm dev:backend
       ```
     - In the monorepo root, start the frontend:
       ```bash
       pnpm dev:frontend
       ```
     - Or launch all active workspaces in dev mode:
       ```bash
       pnpm dev:all
       ```

Your application should now be running with the frontend at `http://localhost:3001` and the backend api gateway at `http://localhost:3000/api`.
