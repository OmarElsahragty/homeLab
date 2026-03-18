# HomeLab — sahragty.me

**Owner:** Omar Elsahragty  
**Host:** sahragty · Ubuntu 24.04.3 LTS · 192.168.1.212  
**Domain:** sahragty.me (Cloudflare Tunnel — no port forwarding)  
**Last Updated:** March 18, 2026

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/server.md](docs/server.md) | Hardware, OS, storage, users, systemd services, cron jobs, backup, optimization history |
| [docs/infrastructure.md](docs/infrastructure.md) | Docker Compose, networks, volumes, resource allocation, container details, logs |
| [docs/services.md](docs/services.md) | Service overview with links to detailed per-service docs |
| [docs/nginx-manager.md](docs/nginx-manager.md) | Nginx Proxy Manager — reverse proxy, security headers, volume structure |
| [docs/frigate.md](docs/frigate.md) | Frigate NVR — GPU acceleration, cameras, recordings, volume structure |
| [docs/n8n.md](docs/n8n.md) | n8n Automation — workflows, PostgreSQL, webhooks, database management |
| [docs/tailscale-setup.md](docs/tailscale-setup.md) | Tailscale Exit Node — VPN gateway, remote access, audit logging |
| [docs/networking.md](docs/networking.md) | Interfaces, DNS, Cloudflare Tunnel, SSL/TLS, ports, Docker networks |
| [security.md](security.md) | Security posture, hardening, headers, monitoring, rotation checklist |
| [docs/operations.md](docs/operations.md) | Day-to-day commands, health checks, troubleshooting, deploy procedures |

---

## Architecture

```
Internet → Cloudflare Edge (TLS) → Cloudflare Tunnel (QUIC)
  → Nginx Proxy Manager (127.0.0.1:80)
    ├── sahragty.me         → Portfolio (Next.js SSR container)
    ├── nvr.sahragty.me     → Frigate NVR        [Basic Auth]
    └── n8n.sahragty.me     → n8n Automation      [Basic Auth]

Tailscale Exit Node (host networking)
  → Remote devices route traffic through homelab → Deeper VPN → Internet
```

Zero port forwarding. Public IP hidden behind Cloudflare. All services bind to localhost.

---

## Services at a Glance

| Service | URL | Tech | Auth |
|---------|-----|------|------|
| Portfolio | https://sahragty.me | Next.js SSR (Docker) | None (public) |
| Frigate NVR | https://nvr.sahragty.me | Docker (GPU-accelerated) | HTTP Basic Auth |
| n8n Automation | https://n8n.sahragty.me | Docker + PostgreSQL | HTTP Basic Auth |
| Tailscale | — | Exit Node VPN Gateway | Tailscale ACL |
| NPM Admin | http://192.168.1.212:81 | Nginx Proxy Manager | Web UI login |

> **Note:** Credentials are stored in environment files and `.env.*` — never committed to version control. See [security.md](security.md) for the credential rotation checklist.

---

## Quick Commands

```bash
# Initial Repository Setup
cp -R volumes.example volumes
cp -R workflows.example workflows

# All Docker commands from:
cd /home/homeLab

docker compose ps                          # Status
docker compose logs -f <service>           # Logs
docker compose restart <service>           # Restart one
docker compose up -d                       # Start all
docker compose down                        # Stop all
docker stats --no-stream                   # Resources

# Portfolio rebuild & deploy
cd /home/homeLab
docker compose build portfolio-app
docker compose up -d portfolio-app

# Tunnel status
systemctl status cloudflared-tunnel.service

# Tailscale status
docker exec tailscale-exit-node tailscale status
```

---

## Key Facts

| Item | Value |
|------|-------|
| Compose file | `/home/homeLab/docker-compose.yml` |
| Volume data | `/home/homeLab/volumes/` |
| Recordings | `/home/storage/records/` |
| Weekly maintenance | Sunday 12:01 AM |

---

> For full details on any topic, see the relevant file in [docs/](docs/).
