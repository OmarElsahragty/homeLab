# Services Reference

All services run as Docker containers from `/home/homeLab/docker-compose.yml`.
Traffic path: **Internet → Cloudflare Tunnel → Nginx Proxy Manager → Service**

**Detailed docs:**
- [docs/nginx-manager.md](nginx-manager.md) — Reverse proxy, static hosting, security headers
- [docs/frigate.md](frigate.md) — NVR, GPU acceleration, cameras, recordings
- [docs/n8n.md](n8n.md) — Workflow automation, PostgreSQL, webhooks
- [docs/tailscale-setup.md](tailscale-setup.md) — Tailscale exit node VPN gateway

---

## Portfolio Website

**URL:** https://sahragty.me  
**Auth:** None (public)  
**Source:** `/home/homeLab/portfolio/`  
**Container:** `portfolio-app` (Next.js standalone Docker)

### Tech Stack

| Tech | Version | Purpose |
|------|---------|---------|
| Next.js | 16.1.6 | SSR framework (App Router) |
| React | 19.1.0 | UI library |
| TypeScript | 5.8.3 | Type safety |
| Framer Motion | 12.12.1 | Animations |
| SCSS | — | Styling |

### Routes

| Route | Page |
|-------|------|
| `/` | Home — landing page |
| `/about` | Professional background |
| `/homelab` | Self-hosted services dashboard |
| `/contact` | Contact information |
| `/valentine` | Valentine's Day interactive page |

### Build & Deploy

```bash
cd /home/homeLab

# Build and deploy portfolio Docker container
docker compose build portfolio-app
docker compose up -d portfolio-app

# View logs
docker logs portfolio-app --tail 50 -f
```

**Serving:** NPM reverse-proxies `sahragty.me` to `portfolio-app:3000` over `nginx-network`.

**Cache headers:** HTML is uncached; static assets use long-lived immutable caching.

---

## Frigate NVR

**See dedicated doc:** [docs/frigate.md](frigate.md)

**URL:** https://nvr.sahragty.me  
**Auth:** HTTP Basic Auth (credentials in security.md)  
**Config:** `/home/homeLab/volumes/frigate-config/config.yaml`  
**Recordings:** `/home/storage/records/`

### Container

| Setting | Value |
|---------|-------|
| Image | `ghcr.io/blakeblackshear/frigate:stable` |
| Port | `127.0.0.1:5000→5000` |
| Memory | 6 GB limit |
| CPU | 6 cores (cpuset 0–5) |
| SHM | 1 GB (for video frame buffering) |
| Restart | `unless-stopped` |

### Hardware Acceleration

| Component | Config |
|-----------|--------|
| GPU | Intel UHD 630 (`/dev/dri` mounted) |
| VAAPI driver | iHD |
| Video decode | Hardware (VAAPI) |
| Object detection | OpenVINO on GPU |

**Environment:**
```env
LIBVA_DRIVER_NAME=iHD
OPENVINO_DEVICE=GPU
FRIGATE_RTSP_PASSWORD=<REDACTED>
TZ=Africa/Cairo
```

### Storage

- **Recordings:** `/home/storage/records/` — auto-retention: 30 days (managed by maintenance script)
- **Temp cache:** tmpfs 1 GB at `/tmp/cache` — cleared on restart, no SSD wear
- **Config:** `/home/homeLab/volumes/frigate-config/config.yaml`
- **Model cache:** `/home/homeLab/volumes/frigate-config/model_cache/`

### Health Check

```bash
curl -f http://localhost:5000/api/stats  # interval: 300s
docker logs frigate --tail 100
```

### Capabilities

- `CAP_PERFMON` — GPU performance monitoring  
- `CAP_SYS_ADMIN` — GPU access

---

## n8n Workflow Automation

**See dedicated doc:** [docs/n8n.md](n8n.md)

**URL:** https://n8n.sahragty.me  
**Webhook URL:** https://n8n.sahragty.me/webhook  
**Auth:** HTTP Basic Auth (credentials in security.md)  
**Webhooks bypass auth:** `https://n8n.sahragty.me/webhook/*`

### Containers

**n8n-app:**
| Setting | Value |
|---------|-------|
| Image | `docker.n8n.io/n8nio/n8n:latest` |
| Port | `127.0.0.1:8000→5678` |
| Memory | 512 MB limit / 256 MB reserve |
| CPU | 2 cores limit / 1 reserve |
| Static IP | 172.25.0.20 (n8n_network) |
| Restart | `always` |

**n8n-postgres:**
| Setting | Value |
|---------|-------|
| Image | `postgres:16-alpine` |
| Port | 5432 (internal only) |
| Memory | 512 MB limit / 256 MB reserve |
| CPU | 1.5 cores / 0.5 reserve |
| Static IP | 172.25.0.10 (n8n_network) |
| Restart | `unless-stopped` |

### Database Credentials

> All database credentials stored in `docker-compose.yml` environment variables. See security.md for credential reference.

| Role | User | Password |
|------|------|----------|
| Admin | `n8n_admin` | `<REDACTED>` |
| App | `n8n_user` | `<REDACTED>` |
| Database | `n8n` | — |

### Key Environment Variables

```env
# Database connection
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=n8n-postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n_user

# Public URLs
WEBHOOK_URL=https://n8n.sahragty.me/webhook
N8N_EDITOR_BASE_URL=https://n8n.sahragty.me

# Auth disabled (NPM handles it)
N8N_BASIC_AUTH_ACTIVE=false
N8N_USER_MANAGEMENT_DISABLED=true
N8N_SKIP_OWNER_SETUP=true

# Execution limits
EXECUTIONS_TIMEOUT=3600
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336    # 14 days retention

TZ=Africa/Cairo
GENERIC_TIMEZONE=UTC
```

**Auth model:** n8n auth is disabled. NPM enforces HTTP Basic Auth for the editor, while `/webhook/*` remains open for integrations.

### Volumes

| Host | Container | Purpose |
|------|-----------|---------|
| `./volumes/n8n-data` | `/home/node/.n8n` | Workflows, credentials, binary data |
| `./volumes/n8n-postgres` | `/var/lib/postgresql/data` | Database files |
| `./scripts/n8n-init-data.sh` | `/docker-entrypoint-initdb.d/init-data.sh` | DB init (ro) |

### Health & Logs

```bash
# Health check
curl http://127.0.0.1:8000/healthz

# Logs
docker logs n8n-app --tail 100 -f
docker logs n8n-postgres --tail 50

# DB admin (inside container)
docker exec -it n8n-postgres psql -U n8n_admin -d n8n
```

---

## Nginx Proxy Manager

**See dedicated doc:** [docs/nginx-manager.md](nginx-manager.md)

**Admin URL:** http://192.168.1.212:81  
**Admin Login:** Credentials in security.md  
**Container:** `nginx-manager`  
**Version:** v2.13.7

### Role

NPM is the reverse proxy layer. It:
1. Receives HTTP traffic from Cloudflare Tunnel on `127.0.0.1:80`
2. Routes requests to the correct upstream based on hostname
3. Enforces HTTP Basic Auth on private services
4. Injects security and Cloudflare headers
5. Proxies the portfolio to the Next.js SSR container

NPM does **not** handle SSL — Cloudflare terminates TLS at the edge.

### Proxy Hosts Config Files

| Domain | Config |
|--------|--------|
| `sahragty.me` | `/data/nginx/proxy_host/portfolio.conf` |
| `n8n.sahragty.me` | `/data/nginx/proxy_host/n8n.conf` |
| `nvr.sahragty.me` | `/data/nginx/proxy_host/nvr.conf` |

### Security Headers Applied to All Hosts

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: (restrictive)
Content-Security-Policy: (self, unsafe-inline/eval, Google Fonts, wss/ws)
```

### Resource Limits

| Resource | Value | Actual Usage |
|----------|-------|-------------|
| Memory limit | 256 MB | ~66 MB (26%) |
| CPU limit | 0.5 cores | minimal |

No SSL/TLS processing overhead (Cloudflare edge handles it).

### Volumes

| Host | Container | Mode |
|------|-----------|------|
| `./volumes/nginx-manager-data` | `/data` | rw |
| `./volumes/nginx-manager-letsencrypt` | `/etc/letsencrypt` | rw (empty) |

### Restart

```bash
cd /home/homeLab && docker compose restart nginx-manager
docker logs nginx-manager --tail 50
```

---

## Tailscale Exit Node

**See dedicated doc:** [docs/tailscale-setup.md](tailscale-setup.md)

**Container:** `tailscale-exit-node`  
**Image:** `tailscale/tailscale:latest`  
**Network Mode:** host (direct kernel networking)

### Purpose

Tailscale provides a WireGuard-based VPN exit node for the homelab. When connected, all traffic from remote devices routes through the home network and then through the Deeper VPN hardware.

### Key Details

| Setting | Value |
|---------|-------|
| Network mode | host |
| Memory limit | 128 MB |
| CPU limit | 0.5 cores |
| Actual memory | ~21 MB (16%) |
| Auth key | Stored in `.env.tailscale` |
| Advertised routes | `0.0.0.0/0` (all traffic) |
| Persistent state | `./volumes/tailscale-data/` |
| Audit logs | `./volumes/tailscale-logs/` |

### Operations

```bash
# View logs
docker compose logs -f tailscale

# Restart
docker compose restart tailscale

# Check audit logs
tail -f /home/homeLab/volumes/tailscale-logs/audit-logs/access-audit.log
```
