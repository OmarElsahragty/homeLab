# Docker Infrastructure

**Compose File:** `/home/homeLab/docker-compose.yml`  
**Volume Storage:** `/home/homeLab/volumes/`  
**Status:** Production — all services healthy

---

## Services Overview

| Container | Image | Port | Status |
|-----------|-------|------|--------|
| `nginx-manager` | jc21/nginx-proxy-manager:latest | `0.0.0.0:81`, `127.0.0.1:80` | ✅ Healthy |
| `frigate` | ghcr.io/blakeblackshear/frigate:stable | `127.0.0.1:5000` | ✅ Healthy |
| `n8n-postgres` | postgres:16-alpine | internal (5432) | ✅ Healthy |
| `n8n-app` | docker.n8n.io/n8nio/n8n:latest | `127.0.0.1:8000` | ✅ Healthy |
| `portfolio-app` | portfolio (multi-stage build) | `127.0.0.1:3000` | ✅ Healthy |
| `tailscale` | tailscale/tailscale:latest | host networking | ✅ Healthy |

All containers: `unless-stopped` restart policy, auto-start at boot via `docker.service`.

---

## Network Architecture

Three Docker networks with strict isolation:

| Network | Type | Subnet | Services |
|---------|------|--------|----------|
| `nginx-network` | External (bridge) | N/A | nginx-manager, frigate, n8n-app, portfolio-app |
| `n8n_network` | Internal (isolated) | 172.25.0.0/16 | n8n-postgres (172.25.0.10), n8n-app (172.25.0.20) |

- **nginx-network** — Shared with cloudflared and host routing. All proxied services join this.
- **n8n_network** — Isolated overlay for secure DB communication. Postgres never exposed outside this network.
- **tailscale** — Uses `network_mode: host` (direct kernel networking, not on Docker networks).

### Host Port Binding (All Localhost)

| Service | Host Port | Container Port | Access |
|---------|-----------|----------------|--------|
| nginx-manager (HTTP) | `127.0.0.1:80` | 80 | Cloudflare tunnel only |
| nginx-manager (Admin) | `0.0.0.0:81` | 81 | LAN: http://192.168.1.212:81 |
| frigate | `127.0.0.1:5000` | 5000 | https://nvr.sahragty.me |
| n8n | `127.0.0.1:8000` | 5678 | https://n8n.sahragty.me |
| portfolio-app | `127.0.0.1:3000` | 3000 | https://sahragty.me |

---

## Volume Structure

All persistent data under `/home/homeLab/volumes/` (bind mounts):

```
/home/homeLab/volumes/
├── nginx-manager-data/           # NPM config + SQLite database
├── nginx-manager-letsencrypt/    # Let's Encrypt dir (empty — Cloudflare handles SSL)
├── frigate-config/
│   ├── config.yaml               # Frigate main config
│   └── model_cache/              # OpenVINO AI model cache
├── n8n-postgres/                 # PostgreSQL data files
├── n8n-data/                     # n8n workflows, credentials, binary data
├── tailscale-data/               # Tailscale persistent auth state
└── tailscale-logs/               # Tailscale audit logs + traffic stats
```

Bind mounts are used for direct access, backups, and portability.

---

## Resource Allocation

| Service | Memory Limit | Memory Reserve | CPU Limit | CPU Reserve | Actual Usage |
|---------|:------------:|:--------------:|:---------:|:-----------:|:------------:|
| nginx-manager | 256 MB | — | 0.5 | — | ~66 MB (26%) |
| frigate | 6 GB | — | 6 | — | ~708 MB (12%) |
| n8n-postgres | 512 MB | 256 MB | 1.5 | 0.5 | ~22 MB (4%) |
| n8n-app | 512 MB | 256 MB | 2 | 1 | ~213 MB (42%) |
| portfolio-app | 256 MB | — | 1 | — | ~80 MB |
| tailscale | 128 MB | — | 0.5 | — | ~21 MB (16%) |
| **Total** | **~7.7 GB** | — | **~11.5** | — | **~1.1 GB** |

Reduced from 18.5 GB total allocation in v5.3.0 optimization (54% reduction).

---

## Container Details

### Nginx Proxy Manager

```yaml
image: jc21/nginx-proxy-manager:latest
ports:
  - "127.0.0.1:80:80"   # HTTP from Cloudflare tunnel
  - "0.0.0.0:81:81"     # Admin UI
resources:
  limits: { memory: 256m, cpus: "0.5" }
healthcheck:
  test: ["/usr/bin/check-health"]
  interval: 30s
```

**Admin:** http://192.168.1.212:81 — credentials in NPM admin UI (see security.md)

**Proxy Hosts:**

| Domain | Upstream | Auth |
|--------|----------|------|
| `sahragty.me` | `portfolio-app:3000` (Next.js SSR) | None (public) |
| `nvr.sahragty.me` | `frigate:5000` | HTTP Basic Auth |
| `n8n.sahragty.me` | `127.0.0.1:8000` | HTTP Basic Auth (webhooks bypass) |

Cloudflare-specific nginx headers applied to all proxy hosts:
```nginx
proxy_set_header X-Real-IP $http_cf_connecting_ip;
proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header CF-RAY $http_cf_ray;
```

### Frigate NVR

```yaml
image: ghcr.io/blakeblackshear/frigate:stable
ports: ["127.0.0.1:5000:5000"]
shm_size: 1gb
devices: ["/dev/dri:/dev/dri"]  # Intel UHD 630 GPU
resources:
  limits: { memory: 6g, cpus: "6" }
  cpuset: "0-5"
environment:
  LIBVA_DRIVER_NAME: iHD
  OPENVINO_DEVICE: GPU
healthcheck:
  test: curl -f http://localhost:5000/api/stats
  interval: 300s
```

**Hardware acceleration:** Intel UHD 630 (iHD driver) for VAAPI video decode + OpenVINO object detection on GPU.

**Volumes:**
| Host | Container | Purpose |
|------|-----------|---------|
| `./volumes/frigate-config` | `/config` | Configuration |
| `/home/storage/records` | `/media/frigate/recordings` | Video recordings |
| `tmpfs:1gb` | `/tmp/cache` | Temporary cache (no SSD wear) |

### n8n Automation

**n8n-postgres:**
```yaml
image: postgres:16-alpine
environment:
  POSTGRES_USER: <REDACTED>
  POSTGRES_PASSWORD: <REDACTED>
  POSTGRES_DB: n8n
networks:
  n8n_network:
    ipv4_address: 172.25.0.10
resources:
  limits: { memory: 512m, cpus: "1.5" }
```

**n8n-app:**
```yaml
image: docker.n8n.io/n8nio/n8n:latest
ports: ["127.0.0.1:8000:5678"]
networks:
  nginx-network: {}
  n8n_network:
    ipv4_address: 172.25.0.20
resources:
  limits: { memory: 512m, cpus: "2" }
  reservations: { memory: 256m, cpus: "1" }
environment:
  DB_TYPE: postgresdb
  DB_POSTGRESDB_HOST: n8n-postgres
  WEBHOOK_URL: https://n8n.sahragty.me/webhook
  N8N_USER_MANAGEMENT_DISABLED: "true"
  N8N_SKIP_OWNER_SETUP: "true"
healthcheck:
  test: wget --spider http://127.0.0.1:5678/healthz
  interval: 30s
```

**Auth model:** n8n's built-in auth is disabled. HTTP Basic Auth is enforced by NPM (credentials in security.md). Webhook endpoints at `/webhook/*` bypass auth.

**DB credentials:** Stored in `docker-compose.yml` environment variables (see security.md for credential reference).

---

## Management Commands

```bash
# All commands must run from /home/homeLab/
cd /home/homeLab

# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart <service>

# View logs (follow)
docker compose logs -f <service>

# View all container status
docker compose ps

# Real-time resource usage
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}"

# Health check status
docker inspect --format='{{.State.Health.Status}}' nginx-manager frigate n8n-app n8n-postgres

# Update a service image
docker compose pull <service>
docker compose up -d <service>
```

---

## Docker Images

| Image | Size | Service |
|-------|------|---------|
| ghcr.io/blakeblackshear/frigate:stable | 2.73 GB | Frigate NVR |
| jc21/nginx-proxy-manager:latest | 1.14 GB | Nginx Proxy Manager |
| docker.n8n.io/n8nio/n8n:latest | 974 MB | n8n automation |
| postgres:16-alpine | 276 MB | PostgreSQL |
| portfolio (local build) | ~250 MB | Portfolio (Next.js SSR) |
| tailscale/tailscale:latest | ~100 MB | Tailscale Exit Node |

Unused legacy images can be removed with `docker system prune -a` after review.

---

## Logging

### Log Rotation (Docker JSON)

| Container | Max Size | Max Files | Total Max |
|-----------|----------|-----------|-----------|
| nginx-manager | 10 MB | 3 | 30 MB |
| frigate | 50 MB | 3 | 150 MB |
| n8n-app | 50 MB | 3 | 150 MB |
| n8n-postgres | 10 MB | 3 | 30 MB |

### NPM Access Logs (Cloudflare Analytics)

Custom log format `cloudflare_detailed` captures: real client IP (from `CF-Connecting-IP`), country, status, method, URL, bytes, user-agent, CF-RAY, upstream, response time.

**Log files** (inside nginx-manager container at `/data/logs/`):

| Domain | Access Log | Error Log |
|--------|-----------|-----------|
| sahragty.me | `portfolio_access.log` | `portfolio_error.log` |
| n8n.sahragty.me | `n8n_access.log` | `n8n_error.log` |
| nvr.sahragty.me | `nvr_access.log` | `nvr_error.log` |

```bash
# Tail a proxy log (from inside container)
docker exec nginx-manager tail -f /data/logs/portfolio_access.log

# Filter by country
docker exec nginx-manager grep "Country: EG" /data/logs/portfolio_access.log

# Filter errors across all hosts
docker exec nginx-manager grep "ERROR:" /data/logs/*_error.log
```

### Service Logs

```bash
docker logs frigate --tail 100 -f
docker logs n8n-app --tail 100 -f
docker logs nginx-manager --tail 100 -f
```
