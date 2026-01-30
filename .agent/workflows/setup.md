---
description: Set up the SRA project for local development
---

Follow these steps to set up the SRA project:

1. **Install Dependencies**:
   - Navigate to the `backend` directory and run:
     ```bash
     npm install
     ```
   - Navigate to the `frontend` directory and run:
     ```bash
     npm install
     ```

2. **Configure Environment Variables**:
   - Create a `.env` file in the `backend` directory based on `.env.example`.
   - Create a `.env.local` file in the `frontend` directory based on `.env.example`.

3. **Database Setup**:
   - Ensure PostgreSQL is running.
   - Run Prisma migrations in the `backend` directory:
     ```bash
     npx prisma migrate dev
     ```

4. **Start Development Servers**:
   - In the `backend` directory:
     ```bash
     npm run dev
     ```
   - In the `frontend` directory:
     ```bash
     npm run dev
     ```

Your application should now be running with the frontend at `http://localhost:3000` (or `3001` as configured) and the backend at `http://localhost:5000`.
