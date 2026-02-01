# Security Incident Response Plan

## Incident Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **P0 - Critical** | Active data breach, system compromise | Immediate | CTO + Security Team |
| **P1 - High** | Potential breach, vulnerability exploit | 1 hour | Security Team |
| **P2 - Medium** | Security misconfiguration, minor leak | 4 hours | DevOps Team |
| **P3 - Low** | Security audit finding, best practice | 24 hours | Development Team |

## Incident Response Procedures

### Phase 1: Detection & Assessment (0-15 minutes)
1. **Identify the incident**
   - Automated alerts (CodeQL, Gitleaks, health checks)
   - User reports
   - Third-party notifications

2. **Assess severity**
   - Data exposure scope
   - User impact
   - System availability

3. **Activate response team**
   - Notify primary engineer: aniketsahaworkspace@gmail.com
   - Create incident channel (Slack/Discord)
   - Start incident log

### Phase 2: Containment (15-60 minutes)
1. **Immediate actions**
   - Isolate affected systems
   - Revoke compromised credentials
   - Enable additional logging

2. **For data breaches:**
   ```bash
   # Rotate all secrets immediately
   cd backend
   node scripts/rotate-secrets.js --emergency
   
   # Revoke all active sessions
   node scripts/revoke-all-sessions.js
   ```

3. **For system compromise:**
   - Take snapshots before changes
   - Isolate affected containers
   - Switch to backup systems

### Phase 3: Eradication (1-4 hours)
1. **Remove threat**
   - Patch vulnerabilities
   - Remove malicious code
   - Update dependencies

2. **Verify clean state**
   ```bash
   # Run security scans
   npm audit --audit-level=high
   docker scan sra-backend:latest
   ```

### Phase 4: Recovery (4-24 hours)
1. **Restore services**
   - Deploy patched version
   - Verify functionality
   - Monitor for anomalies

2. **Database recovery (if needed)**
   ```bash
   # Restore from encrypted backup
   cd backend
   node scripts/backup-cli.js restore <backup-file> --yes
   ```

### Phase 5: Post-Incident (24-72 hours)
1. **User notification**
   - Draft communication (see templates below)
   - Notify affected users within 72 hours
   - Provide remediation steps

2. **Root cause analysis**
   - Document timeline
   - Identify gaps
   - Update security measures

3. **Lessons learned**
   - Update incident response plan
   - Implement preventive measures
   - Train team on findings

## Communication Templates

### Internal Notification
```
SECURITY INCIDENT: [P0/P1/P2/P3]

Incident ID: INC-[YYYYMMDD]-[###]
Detected: [Timestamp]
Severity: [Level]
Status: [Detected/Contained/Resolved]

Summary:
[Brief description]

Impact:
[Affected systems/users]

Actions Taken:
- [Action 1]
- [Action 2]

Next Steps:
- [Step 1]
- [Step 2]
```

### User Notification (Data Breach)
```
Subject: Important Security Notice - SRA Platform

Dear SRA User,

We are writing to inform you of a security incident that may have affected your account.

What Happened:
[Clear, non-technical explanation]

What Information Was Involved:
[Specific data types]

What We're Doing:
- [Action 1]
- [Action 2]

What You Should Do:
1. Reset your password immediately
2. Review your account activity
3. Enable two-factor authentication

We take security seriously and apologize for any concern this may cause.

For questions: security@sra-platform.com

Sincerely,
SRA Security Team
```

## Secret Rotation Procedures

### Emergency Rotation (Breach Scenario)
```bash
# 1. Generate new secrets
node scripts/generate-secrets.js --output .env.new

# 2. Update Vercel secrets
vercel env add JWT_SECRET production < .env.new
vercel env add CSRF_SECRET production < .env.new

# 3. Update Supabase connection
# (Manual via Supabase dashboard)

# 4. Redeploy applications
vercel --prod

# 5. Revoke old sessions
node scripts/revoke-all-sessions.js
```

### Scheduled Rotation (90-day policy)
See [OPERATIONS.md](../../OPERATIONS.md) "Secrets Rotation Policy"

## Escalation Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary Engineer | aniketsahaworkspace@gmail.com | 24/7 |
| Supabase Support | support.supabase.com | Business hours |
| Vercel Support | vercel.com/support | 24/7 (Enterprise) |
| Google AI Support | cloud.google.com/support | Business hours |

## Compliance Requirements

### GDPR (if applicable)
- Notify supervisory authority within 72 hours
- Document breach in compliance register
- Assess need for user notification

### Data Retention
- Incident logs: 7 years
- Forensic data: 2 years
- Communication records: 5 years

## Related Documentation
- [SECURITY.md](../../SECURITY.md) - Overall security policy
- [ENCRYPTION.md](./ENCRYPTION.md) - Encryption procedures
- [OPERATIONS.md](../../OPERATIONS.md) - Operational procedures
