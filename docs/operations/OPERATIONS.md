# Operations & Disaster Recovery Guide: SRA Platform

## 📑 Overview
This document outlines the operational procedures, backup strategies, and disaster recovery plans for the SRA platform to ensure data integrity and system availability.

## ⏱️ Service Level Objectives (SLO)
- **RTO (Recovery Time Objective):** 4 Hours (Target time to restore service after a disaster)
- **RPO (Recovery Point Objective):** 1 Hour (Maximum acceptable data loss)

---

## 💾 Backup Strategy

### 1. Database (Supabase PostgreSQL)
- **Automated Backups:** Daily snapshots managed by Supabase.
- **PITR (Point-In-Time Recovery):** Enabled for 7-day retention (Allows recovery to any specific second).
- **Manual Backups:** Recommended before major migrations.
  ```bash
  # Example: Export schema and data
  pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
  ```

### 2. File Assets (If applicable)
- All configuration and code are versioned in GitHub.
- Environment variables are stored in Vercel/Production Secrets.

### 3. Automated Backup System
- **Weekly Automated Backups:** GitHub Actions workflow runs every Sunday at 2 AM UTC.
- **Encryption:** All backups are encrypted using AES-256-GCM before storage.
- **Retention:** Backups are retained for 30 days, with automatic cleanup.
- **Verification:** Each backup is verified for integrity using SHA-256 checksums.

#### Manual Backup Commands
```bash
# Run backup commands from the monorepo root via workspace

# Create encrypted backup
npm run backup:create --workspace=backend

# List all backups
npm run backup:list --workspace=backend

# Restore from backup
npm run backup:restore --workspace=backend -- <filename> --yes

# Verify backup integrity
npm run backup:verify --workspace=backend -- <filename>

# Cleanup old backups
npm run backup:cleanup --workspace=backend
```
#### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (typically transaction-pooled connection on port `6543`).
- `DIRECT_URL`: Primary direct database connection string (typically unpooled on port `5432`), prioritized by `BackupService` to prevent transaction pooler timeouts or locks during long backup/restore exports.
- `BACKUP_ENCRYPTION_KEY`: Master key for backup encryption (min 32 characters).
- `BACKUP_DIR`: Directory for backup storage (default: `./backups`).
- `BACKUP_RETENTION_DAYS`: Number of days to retain backups (default: 30).
- `BACKUP_ENCRYPTION_SALT`: Unique salt string used for derived keys during encryption.

#### Direct Connection & Port Extraction Architecture
The `BackupService` utilizes a robust connection string parsing algorithm:
1. **Prioritization**: Prioritizes `DIRECT_URL` if present, falling back to `DATABASE_URL` to ensure it targets unpooled database connections.
2. **Dynamic Port Extraction**: Dynamically parses the connection URI to extract host, user, password, and port parameters. If a port is not explicitly declared, it safely defaults to `5432`.
3. **Cross-Platform Compatibility (Windows Support)**:
   - On Unix systems, passwords are fed inline using the standard `PGPASSWORD` environment variable prefix.
   - On Windows systems, to prevent shell-escaping issues and environment leakage, the service writes a temporary secure password file (`.pgpass`) inside the OS temporary directory (`os.tmpdir()`) with strict mode `0o600`, references it via the `PGPASSFILE` environment variable, runs `pg_dump`/`pg_restore`, and immediately cleans up the temporary file on completion or error.

#### Backup Service Testing & Verification
The operational stability of our database backup and restore subsystem is verified by the Jest unit test suite (`backup_service.test.js`). The test suite validates the internal backup command string construction logic by mocking external calls using native ES Module dynamics:
- Verifies extraction of custom port parameters (e.g. `6543` vs. `5432`).
- Verifies proper prioritizing of direct connection strings (`DIRECT_URL`).
- Verifies fallback port logic.
- Verifies secure command argument construction for both Windows (`pgpass`) and Unix (`PGPASSWORD`) runtimes.

---

## 🛡️ Disaster Recovery (DR) Runbook

### Scenario A: Database Corruption/Loss
1. **Identify:** Detect via health checks or error logs.
2. **Assess:** Determine the last known good state via Supabase dashboard.
3. **Recover:**
   - Navigate to Supabase > Database > Backups.
   - Select "Restore" and choose the point in time before corruption.
   - Verify connectivity via `/api/health`.

### Scenario B: Application Service Failure
1. **Identify:** Vercel deployment failure or 5xx errors.
2. **Recover:**
   - Revert to the last stable deployment in Vercel.
   - Check GitHub Actions for build failures in `main`.
   - Re-deploy via `docker-compose up --build -d` for self-hosted instances.

---

## 🔒 Secrets Rotation Policy
Secrets should be rotated every **90 days** or immediately upon suspected compromise.

| Secret | Rotation Command/Procedure | Impact |
| :--- | :--- | :--- |
| `JWT_SECRET` | Update env var + Restart Services | Logs out all active users |
| `DATABASE_URL` | Generate new password in Supabase | 1-2 min downtime during update |
| `GEMINI_API_KEY` | Generate new key in Google AI Studio | Immediate switch-over |
| `QSTASH_TOKEN` | Rotate in Upstash Dashboard | Interruption to async jobs |

---

- **Interruption to async jobs**: Interruption to async jobs.

## 🛡️ Security Hardening Standards
### Authentication
The application uses JWT Bearer tokens for all authenticated API requests. Tokens are stateless and managed via secure storage on the client.

## 🩺 System Health Monitoring
Monitoring is performed hourly via GitHub Actions (`health-check.yml`).
- **Endpoint:** `https://your-domain.com/api/health`
- **Critical Components:**
  - Prisma Connectivity
  - AI Provider API Status
  - **MAS Orchestration Status** (PO, Architect, Developer)
  - **Evaluation Service Readiness** (Critic & RAG Eval)
  - QStash Worker Readiness

---

## 📞 Escalation Path
1. **Primary Engineer:** [Aniket Saha](mailto:aniketsahaworkspace@gmail.com)
2. **Infrastructure Provider Support:**
   - Supabase Support Context
   - Vercel Incident Dashboard
   - Google AI Support
