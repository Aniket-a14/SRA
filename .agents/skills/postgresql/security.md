---
name: postgresql-security
description: PostgreSQL security including authentication, SSL/TLS, row-level security, audit logging, and privilege management for enterprise deployments.
---

# PostgreSQL Security

## Authentication Configuration

```bash
# Edit pg_hba.conf (/etc/postgresql/15/main/pg_hba.conf)

# IPv4 local connections
host    all             all             127.0.0.1/32            scram-sha-256

# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256

# Remote TCP connections with password
host    mydb            developer       192.168.1.0/24          scram-sha-256

# Unix socket (local only, most secure)
local   all             all                                      trust

# Require password for local connections
local   all             all                                      scram-sha-256
```

## SSL/TLS Configuration

```bash
# Generate self-signed certificate
sudo openssl req -new -x509 -days 365 -nodes \
  -out /etc/postgresql/15/main/server.crt \
  -keyout /etc/postgresql/15/main/server.key

# Set proper permissions
sudo chmod 600 /etc/postgresql/15/main/server.key
sudo chown postgres:postgres /etc/postgresql/15/main/server.*

# Enable SSL in postgresql.conf
ssl = on
ssl_cert_file = '/etc/postgresql/15/main/server.crt'
ssl_key_file = '/etc/postgresql/15/main/server.key'
```

## User & Role Security

```sql
-- Create user with restricted permissions
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong_password';

-- Revoke default public privileges
REVOKE ALL ON DATABASE mydb FROM PUBLIC;

-- Grant only necessary privileges
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON schema_table TO app_user;

-- Create read-only role
CREATE ROLE read_only WITH NOLOGIN;
GRANT CONNECT ON DATABASE mydb TO read_only;
GRANT USAGE ON SCHEMA public TO read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;

-- Add read-only user with login
CREATE ROLE report_user WITH LOGIN PASSWORD 'password' IN ROLE read_only;

-- Enforce password requirements
ALTER ROLE app_user VALID UNTIL '2025-12-31';
ALTER ROLE app_user WITH CONNECTION LIMIT 5;
```

## Row-Level Security (RLS)

```sql
-- Create table with RLS
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  salary DECIMAL(10,2),
  department_id INT,
  created_by VARCHAR(100)
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create policy - users see only their department
CREATE POLICY dept_isolation ON employees
  FOR SELECT
  USING (department_id = (
    SELECT department_id FROM employees
    WHERE created_by = current_user LIMIT 1
  ));

-- Users can only update their own records
CREATE POLICY user_update ON employees
  FOR UPDATE
  USING (created_by = current_user);

-- View policies
\d+ employees
```

## Audit Logging

```bash
# Enable query logging in postgresql.conf
log_statement = 'all'           # Log all statements
log_min_duration_statement = 1000  # Log queries over 1 second
log_duration = on               # Log duration
log_connections = on            # Log connections
log_disconnections = on         # Log disconnections
log_lock_waits = on            # Log lock wait times
```

## Privilege Audit

```sql
-- Check object privileges
SELECT * FROM information_schema.table_privileges
WHERE table_schema = 'public';

-- Check role membership
SELECT role_name, member_name, admin_option
FROM information_schema.role_table_grants;

-- Find users with superuser privileges
SELECT usename FROM pg_user WHERE usesuper;

-- Check default privileges
SELECT * FROM information_schema.default_privileges;

-- Set default privileges for new tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO read_only;
```

## Extension Security

```sql
-- Install security-related extensions

-- Install pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive data
CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255),
  password_hash TEXT,
  encrypted_ssn bytea
);

-- Insert encrypted data
INSERT INTO users VALUES (
  1,
  'user@example.com',
  crypt('password', gen_salt('bf')),
  pgp_sym_encrypt('123-45-6789', 'encryption_key')
);

-- Verify password
SELECT email FROM users
WHERE password_hash = crypt('password', password_hash);

-- Install pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## Compliance & Audit Trail

```sql
-- Create audit log table
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  operation TEXT,
  username TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_data JSONB,
  new_data JSONB
);

-- Create trigger function for audit
CREATE OR REPLACE FUNCTION audit_function() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, username, old_data, new_data)
  VALUES (TG_TABLE_NAME, TG_OP, current_user,
          row_to_json(OLD), row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on table
CREATE TRIGGER employees_audit
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_function();
```

## Network Security

```bash
# Configure firewall (UFW on Linux)
sudo ufw allow from 192.168.1.0/24 to any port 5432

# Only listen on specific interface
echo "listen_addresses = '192.168.1.10'" >> postgresql.conf

# Disable superuser remote access
# In pg_hba.conf
host    all             postgres        0.0.0.0/0              reject
```

## Best Practices Checklist

✅ Use strong passwords with character requirements
✅ Enable SSL/TLS for remote connections
✅ Implement least privilege principle
✅ Use connection limits to prevent resource exhaustion
✅ Enable audit logging for compliance
✅ Regular backups with encryption
✅ Monitor and alert on failed logins
✅ Use row-level security for multi-tenant apps
✅ Keep PostgreSQL updated
✅ Regular security audits and penetration testing
