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

## 🩺 System Health Monitoring
Monitoring is performed hourly via GitHub Actions (`health-check.yml`).
- **Endpoint:** `https://your-domain.com/api/health`
- **Critical Components:**
  - Prisma Connectivity
  - AI Provider API Status
  - QStash Worker Readiness

---

## 📞 Escalation Path
1. **Primary Engineer:** [Aniket Saha](mailto:aniketsahaworkspace@gmail.com)
2. **Infrastructure Provider Support:**
   - Supabase Support Context
   - Vercel Incident Dashboard
   - Google AI Support
