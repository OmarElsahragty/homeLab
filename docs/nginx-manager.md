# Nginx Proxy Manager (NPM)

**Admin URL:** http://192.168.1.212:81  
**Admin Login:** See security.md for credentials  
**Container:** `nginx-manager`  
**Image:** `jc21/nginx-proxy-manager:latest`  
**HTTP Port:** `127.0.0.1:80` (from Cloudflare Tunnel only)  
**Admin Port:** `0.0.0.0:81` (LAN accessible)

---

## Purpose

NPM is the centralized reverse proxy for all HomeLab web services. It:

1. **Receives HTTP traffic** from Cloudflare Tunnel on `127.0.0.1:80`
2. **Routes requests** to the correct upstream service based on hostname
3. **Enforces HTTP Basic Auth** on private services (Frigate, n8n)
4. **Injects security headers** (CSP, HSTS, X-Frame-Options, etc.)
5. **Proxies the Portfolio** to the Next.js SSR Docker container

NPM does **not** handle SSL — Cloudflare terminates TLS at the edge. NPM receives plaintext HTTP from the tunnel.

### Architecture

```
Internet → Cloudflare Edge (TLS termination)
  → Cloudflare Tunnel (QUIC)
    → cloudflared daemon
      → Nginx Proxy Manager (127.0.0.1:80 — HTTP only)
        ├── sahragty.me         → portfolio-app:3000 (Next.js SSR)
        ├── nvr.sahragty.me     → frigate:5000       [Basic Auth]
        └── n8n.sahragty.me     → 127.0.0.1:8000    [Basic Auth]
```

---

## Container Configuration

```yaml
image: jc21/nginx-proxy-manager:latest
container_name: nginx-manager
restart: unless-stopped
stop_grace_period: 30s

ports:
  - "127.0.0.1:80:80"     # HTTP from Cloudflare Tunnel (localhost only)
  - "0.0.0.0:81:81"       # Admin dashboard (LAN accessible)

environment:
  DB_SQLITE_FILE: "/data/database.sqlite"
  DISABLE_IPV6: "true"
  X_FRAME_OPTIONS: "SAMEORIGIN"

networks:
  - nginx-network

healthcheck:
  test: ["/usr/bin/check-health"]
  interval: 30s
  timeout: 3s
  start_period: 10s
  retries: 2

deploy:
  resources:
    limits:
      cpus: "0.5"
      memory: 256M
    reservations:
      memory: 32M

logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

| Resource | Limit | Actual Usage |
|----------|-------|-------------|
| Memory | 256 MB | ~68 MB (26%) |
| CPU | 0.5 cores | minimal |
| Log storage | 30 MB max | 3 × 10 MB rotation |

---

## Proxy Hosts

| Domain | Upstream | Auth | Config File |
|--------|----------|------|-------------|
| `sahragty.me` | `portfolio-app:3000` (Next.js SSR) | None (public) | `proxy_host/portfolio.conf` |
| `nvr.sahragty.me` | `frigate:5000` | HTTP Basic Auth | `proxy_host/nvr.conf` |
| `n8n.sahragty.me` | `127.0.0.1:8000` | HTTP Basic Auth (webhooks bypass) | `proxy_host/n8n.conf` |

**HTTP Basic Auth credentials** (for nvr and n8n): See security.md

### Cloudflare Headers

Applied to all proxy hosts to preserve real client IP:

```nginx
proxy_set_header X-Real-IP $http_cf_connecting_ip;
proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header CF-RAY $http_cf_ray;
```

### Custom Logging

NPM uses a `cloudflare_detailed` log format capturing: real client IP, country, status, method, URL, bytes, user-agent, CF-RAY, upstream, and response time.

---

## Security Headers

Applied to all proxy hosts:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "..." always;
add_header Content-Security-Policy "default-src 'self'; ..." always;
```

### Cache Headers (Portfolio)

- **HTML:** `no-store, no-cache` (always fetch fresh)
- **JS/CSS/images:** 1-year cache + `immutable` flag (Cloudflare caches further)

---

## Volume Structure

### Host Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|---------------|------|---------|
| `./volumes/nginx-manager-data` | `/data` | rw | NPM config + database |
| `./volumes/nginx-manager-letsencrypt` | `/etc/letsencrypt` | rw | Let's Encrypt (empty — Cloudflare handles SSL) |
| `/etc/localtime` | `/etc/localtime` | ro | Time sync |
| `/etc/timezone` | `/etc/timezone` | ro | Timezone sync |

### File Tree

```
/home/homeLab/volumes/nginx-manager-data/       → /data/
├── database.sqlite                              # NPM configuration database
├── keys.json                                    # Internal keys
├── access/
│   └── sahragty                                 # HTTP Basic Auth access list
├── custom_ssl/                                  # Custom SSL certs (empty)
├── letsencrypt-acme-challenge/                  # ACME challenges (empty)
├── logs/
│   ├── portfolio_access.log                     # sahragty.me access log
│   ├── portfolio_error.log                      # sahragty.me errors
│   ├── n8n_access.log                           # n8n access log
│   ├── n8n_error.log                            # n8n errors
│   ├── nvr_access.log                           # Frigate NVR access log
│   └── nvr_error.log                            # Frigate NVR errors
├── nginx/
│   ├── proxy_host/
│   │   ├── portfolio.conf                       # sahragty.me proxy config
│   │   ├── nvr.conf                             # nvr.sahragty.me proxy config
│   │   └── n8n.conf                             # n8n.sahragty.me proxy config
│   ├── custom/
│   │   ├── http_top.conf                        # Global HTTP config
│   │   ├── server_proxy.conf                    # Global proxy settings
│   │   └── 404.html                             # Custom 404 page
│   ├── default_host/
│   │   └── site.conf                            # Default host config
│   ├── default_www/                             # Default web root
│   ├── dead_host/                               # Disabled hosts
│   ├── redirection_host/                        # Redirections
│   ├── stream/                                  # TCP/UDP streams
│   └── temp/                                    # Temporary files
```

```
/home/homeLab/volumes/nginx-manager-letsencrypt/ → /etc/letsencrypt/
└── (empty — Cloudflare handles SSL)
```

---

## Portfolio Proxy

The portfolio runs as `portfolio-app` on port 3000. NPM proxies `sahragty.me` to it over `nginx-network`.

**Deploy:** `cd /home/homeLab && docker compose build portfolio-app && docker compose up -d portfolio-app`

---

## Operations

### Restart

```bash
cd /home/homeLab
docker compose restart nginx-manager
docker logs nginx-manager --tail 50
```

### View Logs

```bash
# Container logs
docker logs nginx-manager --tail 100 -f

# Per-service access logs
docker exec nginx-manager tail -f /data/logs/portfolio_access.log
docker exec nginx-manager tail -f /data/logs/n8n_access.log
docker exec nginx-manager tail -f /data/logs/nvr_access.log

# All error logs
docker exec nginx-manager grep "ERROR:" /data/logs/*_error.log

# Filter by country
docker exec nginx-manager grep "Country: EG" /data/logs/portfolio_access.log
```

### Update

```bash
cd /home/homeLab
docker compose pull nginx-manager
docker compose up -d --no-deps nginx-manager
```
