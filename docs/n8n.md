# n8n Workflow Automation

**URL:** https://n8n.sahragty.me  
**Webhook URL:** https://n8n.sahragty.me/webhook  
**Auth:** HTTP Basic Auth (credentials in security.md)  
**Container (app):** `n8n-app`  
**Container (db):** `n8n-postgres`  
**Image (app):** `docker.n8n.io/n8nio/n8n:latest`  
**Image (db):** `postgres:16-alpine`

---

## Table of Contents

1. [Purpose](#purpose)
2. [Architecture](#architecture)
3. [n8n App Container](#n8n-app-container)
4. [PostgreSQL Container](#postgresql-container)
5. [Authentication](#authentication)
6. [Volume Structure](#volume-structure)
7. [Database](#database)
8. [Operations](#operations)

---

## Purpose

n8n is a self-hosted visual workflow automation platform (similar to Zapier/Make). It provides:

- **400+ integrations** — HTTP, databases, APIs, cloud services
- **Visual workflow editor** — drag-and-drop node-based design
- **Execution history** — full debugging and retry capabilities
- **Cron scheduling** — time-based triggers
- **Custom code nodes** — JavaScript and Python support
- **Webhooks** — external trigger endpoints

### Architecture

```
External API/Webhook
  → Cloudflare Tunnel → NPM
    → n8n-app (127.0.0.1:8000)
      ├── Workflow Engine
      ├── Execution Runner
      └── PostgreSQL Database (172.25.0.10:5432)
            └── n8n_db (workflows, executions, credentials)
```

### Network Topology

```
nginx-network:
  └── n8n-app (172.25.0.20) ← NPM reverse proxy access

n8n_network (172.25.0.0/16 — isolated):
  ├── n8n-app (172.25.0.20) → database queries
  └── n8n-postgres (172.25.0.10) → not exposed to host
```

PostgreSQL is only accessible on the isolated `n8n_network`. No host port binding, no external access.

---

## n8n App Container

```yaml
image: docker.n8n.io/n8nio/n8n:latest
container_name: n8n-app
restart: always
stop_grace_period: 30s
user: "1000:1000"                    # Non-root

ports:
  - "127.0.0.1:8000:5678"

networks:
  n8n_network:
    ipv4_address: 172.25.0.20
  nginx-network: {}

depends_on:
  postgres:
    condition: service_healthy

healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:5678/healthz || exit 1"]
  interval: 30s
  timeout: 15s
  retries: 5
  start_period: 120s

deploy:
  resources:
    limits:
      memory: 512M
      cpus: "2"
    reservations:
      memory: 256M
      cpus: "1"

security_opt:
  - no-new-privileges:true

logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "3"
```

| Resource | Limit | Actual Usage |
|----------|-------|-------------|
| Memory | 512 MB | ~212 MB (41%) |
| CPU | 2 cores | Variable |
| Log storage | 150 MB max | 3 × 50 MB rotation |

### Key Environment Variables

```env
# Database connection
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=n8n-postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n_user
DB_POSTGRESDB_PASSWORD=<REDACTED>
DB_POSTGRESDB_SCHEMA=public

# Public URLs
N8N_PORT=5678
WEBHOOK_URL=https://n8n.sahragty.me/webhook
N8N_EDITOR_BASE_URL=https://n8n.sahragty.me

# Auth disabled (NPM handles it)
N8N_BASIC_AUTH_ACTIVE=false
N8N_USER_MANAGEMENT_DISABLED=true
N8N_SKIP_OWNER_SETUP=true
N8N_AUTH_EXCLUDE_ENDPOINTS=/health,/webhook

# Execution config
EXECUTIONS_MODE=regular
EXECUTIONS_TIMEOUT=3600                  # 1 hour timeout
EXECUTIONS_TIMEOUT_MAX=7200              # 2 hour absolute max
N8N_RUNNERS_ENABLED=true
N8N_RUNNERS_MODE=internal

# Data retention
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336              # 14 days

# Security
N8N_SECURE_COOKIE=true                   # HTTPS at Cloudflare edge
N8N_BLOCK_ENV_ACCESS_IN_NODE=false

# Logging
N8N_LOG_LEVEL=info
N8N_LOG_OUTPUT=console

# Timezone
TZ=Africa/Cairo
GENERIC_TIMEZONE=UTC

# Features
N8N_HIRING_BANNER_ENABLED=false
N8N_DIAGNOSTICS_ENABLED=false
N8N_TEMPLATES_ENABLED=true
N8N_COMMUNITY_PACKAGES_ENABLED=true
```

---

## PostgreSQL Container

```yaml
image: postgres:16-alpine
container_name: n8n-postgres
restart: always
stop_grace_period: 30s

expose:
  - "5432"                               # Internal only — NOT exposed to host

networks:
  n8n_network:
    ipv4_address: 172.25.0.10

healthcheck:
  test: ["CMD-SHELL", "pg_isready -h localhost -U n8n_admin -d n8n"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

deploy:
  resources:
    limits:
      memory: 512M
      cpus: "1.5"
    reservations:
      memory: 256M
      cpus: "0.5"

security_opt:
  - no-new-privileges:true

logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

| Resource | Limit | Actual Usage |
|----------|-------|-------------|
| Memory | 512 MB | ~22 MB (4%) |
| CPU | 1.5 cores | minimal |
| Log storage | 30 MB max | 3 × 10 MB rotation |

### Performance Tuning

```env
POSTGRES_SHARED_PRELOAD_LIBRARIES=pg_stat_statements
POSTGRES_MAX_CONNECTIONS=200
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
```

---

## Authentication

n8n's built-in authentication is **completely disabled**. NPM enforces HTTP Basic Auth at the proxy level.

| Setting | Value | Purpose |
|---------|-------|---------|
| `N8N_BASIC_AUTH_ACTIVE` | `false` | Disable n8n's own auth |
| `N8N_USER_MANAGEMENT_DISABLED` | `true` | No user management UI |
| `N8N_SKIP_OWNER_SETUP` | `true` | Skip initial owner setup screen |
| `N8N_AUTH_EXCLUDE_ENDPOINTS` | `/health,/webhook` | Allow webhooks without auth |

**Result:**
- **Editor UI** (`https://n8n.sahragty.me`) — protected by NPM HTTP Basic Auth
- **Webhooks** (`https://n8n.sahragty.me/webhook/*`) — bypass auth for external integrations
- **Health endpoint** (`/healthz`) — accessible without auth (for monitoring)

---

## Volume Structure

### Host Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|---------------|------|---------|
| `./volumes/n8n-data` | `/home/node/.n8n` | rw | n8n application data |
| `./volumes/n8n-postgres` | `/var/lib/postgresql/data` | rw | PostgreSQL database files |
| `./scripts/n8n-init-data.sh` | `/docker-entrypoint-initdb.d/init-data.sh` | ro | Database initialization script |

### n8n Data Volume

```
/home/homeLab/volumes/n8n-data/                 → /home/node/.n8n/
├── config                                       # n8n runtime config
├── crash.journal                                # Crash recovery journal
├── n8nEventLog.log                              # Event log (current)
├── n8nEventLog-1.log                            # Event log (rotated)
├── binaryData/                                  # Binary file storage (workflow attachments)
├── git/                                         # Git integration data
├── nodes/
│   └── package.json                             # Community node packages
├── ssh/                                         # SSH key storage (for git operations)
```

### PostgreSQL Data Volume

```
/home/homeLab/volumes/n8n-postgres/             → /var/lib/postgresql/data/
├── PG_VERSION                                   # PostgreSQL version (16)
├── postgresql.conf                              # Server configuration
├── postgresql.auto.conf                         # Auto-generated config
├── pg_hba.conf                                  # Client authentication
├── pg_ident.conf                                # User name mapping
├── postmaster.opts                              # Server start options
├── postmaster.pid                               # Server process ID
├── base/                                        # Database file storage
├── global/                                      # Cluster-wide tables
├── pg_wal/                                      # Write-ahead logs
├── pg_xact/                                     # Transaction commit data
├── pg_stat/                                     # Statistics data
├── pg_stat_tmp/                                 # Temporary statistics
├── pg_multixact/                                # Multi-transaction status
├── pg_commit_ts/                                # Commit timestamps
├── pg_logical/                                  # Logical decoding
├── pg_notify/                                   # LISTEN/NOTIFY data
├── pg_serial/                                   # Serializable transaction data
├── pg_snapshots/                                # Exported snapshots
├── pg_subtrans/                                 # Subtransaction status
├── pg_tblspc/                                   # Tablespace symlinks
├── pg_twophase/                                 # Two-phase transaction state
├── pg_dynshmem/                                 # Dynamic shared memory
└── pg_replslot/                                 # Replication slot data
```

---

## Database

### Credentials

> All database credentials stored in `docker-compose.yml` environment variables. See security.md for credential reference.

| Role | Username | Password | Purpose |
|------|----------|----------|----------|
| Admin | `n8n_admin` | `<REDACTED>` | Superuser (migrations, maintenance) |
| App | `n8n_user` | `<REDACTED>` | Application user (n8n runtime) |
| Database | `n8n` | — | Database name |

### Initialization

The `scripts/n8n-init-data.sh` script runs on first PostgreSQL startup via Docker entrypoint. It creates the application user (`n8n_user`) and grants appropriate permissions.

### Data Retention

Execution history is automatically pruned:
- `EXECUTIONS_DATA_PRUNE=true`
- `EXECUTIONS_DATA_MAX_AGE=336` — keeps 14 days of execution history

---

## Operations

### Restart

```bash
cd /home/homeLab

# Restart n8n app (preserves database connection)
docker compose restart n8n

# Restart database (will trigger n8n reconnect)
docker compose restart postgres
```

### Health Check

```bash
# n8n health
curl http://127.0.0.1:8000/healthz

# PostgreSQL health
docker exec n8n-postgres pg_isready -U n8n_admin -d n8n
```

### View Logs

```bash
# n8n app logs
docker logs n8n-app --tail 100 -f

# PostgreSQL logs
docker logs n8n-postgres --tail 50

# NPM access log
docker exec nginx-manager tail -f /data/logs/n8n_access.log
```

### Database Management

```bash
# Connect to database
docker exec -it n8n-postgres psql -U n8n_admin -d n8n

# Backup database
docker exec n8n-postgres pg_dump -U n8n_admin n8n > /tmp/n8n-db-$(date +%Y%m%d).sql

# Restore database
docker exec -i n8n-postgres psql -U n8n_admin -d n8n < /tmp/n8n-db-[DATE].sql

# Reset n8n user/owner (removes login prompts if they re-appear)
docker exec -i n8n-postgres psql -U n8n_admin -d n8n -c "DELETE FROM \"user\";"
docker compose restart n8n
```

### Update

```bash
cd /home/homeLab
docker compose pull n8n postgres
docker compose up -d n8n postgres
```
