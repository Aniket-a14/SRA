---
description: Deploy the SRA application using Docker Compose
---

This workflow guides you through deploying the SRA application in a containerized environment.

1. **Prerequisites**:
   - Ensure Docker and Docker Compose are installed.
   - Ensure all environment variables in the root `docker-compose.yml` (or `.env` files if used by compose) are set.

2. **Build and Start Containers**:
   // turbo
   Run the following command in the project root:
   ```bash
   docker-compose up --build -d
   ```

3. **Verify Deployment**:
   - Check the status of the containers:
     ```bash
     docker-compose ps
     ```
   - Access the frontend at `http://localhost`.

4. **Database Migrations (In-Container)**:
   - If migrations need to be run inside the container:
     ```bash
     docker-compose exec backend npx prisma migrate deploy
     ```

5. **Stop Deployment**:
   ```bash
   docker-compose down
   ```
