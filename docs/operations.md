# Operations Reference

Day-to-day management and troubleshooting.

---

## Quick Commands

### Service Management

```bash
# All commands run from /home/homeLab/
cd /home/homeLab

# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart one service
docker compose restart <service>

# View live logs
docker compose logs -f <service>

# Status overview
docker compose ps

# Resource usage
docker stats --no-stream
```

### System Management

```bash
# System package update
sudo apt update && sudo apt upgrade -y

# Docker cleanup (removes unused images)
docker system prune -a

# Disk usage
df -h / /home
du -sh /home/homeLab/volumes/*/

# Reboot
sudo reboot
```

---

## Service URLs & Ports

| Service | URL | Local Port | Auth |
|---------|-----|-----------|------|
| Portfolio | https://sahragty.me | 3000 | None |
| Frigate NVR | https://nvr.sahragty.me | 5000 | HTTP Basic Auth (see security.md) |
| n8n Automation | https://n8n.sahragty.me | 8000 | HTTP Basic Auth (see security.md) |
| NPM Admin | http://192.168.1.212:81 | 81 | See security.md |

---

## Health Checks

```bash
# All container health at a glance
docker ps --format "table {{.Names}}\t{{.Status}}"

# Inspect health status of key containers
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' \
  nginx-manager frigate n8n-app n8n-postgres

# Cloudflare Tunnel status
systemctl status cloudflared-tunnel.service
cloudflared tunnel info homelab-sahragty

# Verify services responding
curl -s -o /dev/null -w "%{http_code}" https://sahragty.me
curl -s -o /dev/null -w "%{http_code}" https://nvr.sahragty.me
curl -s -o /dev/null -w "%{http_code}" https://n8n.sahragty.me
```

---

## Troubleshooting

### Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| **502 Bad Gateway** | Backend container not running | `docker ps` → restart affected container |
| **401 Unauthorized** | Wrong credentials | Check the current access credentials |
| **Site unreachable** | Tunnel disconnected | `systemctl restart cloudflared-tunnel.service` |
| **Container won't start** | Port conflict or image issue | `docker compose down && docker compose up -d` |
| **High CPU** | Frigate processing camera streams | Normal — check `docker stats frigate` |
| **n8n 503** | Container starting | Wait 2 min; then restart if persisting |
| **`docker compose` error "no configuration file provided"** | Wrong working directory | Always run from `/home/homeLab/` |

### Debug Flow

```bash
# 1. Container status
docker ps -a

# 2. Container logs
docker logs --tail 100 <container>

# 3. System logs
systemctl status docker
journalctl -u cloudflared-tunnel.service -n 50

# 4. Network connectivity
curl -I http://127.0.0.1:80           # Test NPM directly
sudo ss -tlnp                           # Verify port bindings

# 5. DNS
dig sahragty.me @8.8.8.8
cloudflared tunnel ingress validate
```

---

## Portfolio Deployment

```bash
cd /home/homeLab

# Build the Docker image
docker compose build portfolio-app

# Deploy (or redeploy)
docker compose up -d portfolio-app

# Check it's running
docker logs portfolio-app --tail 50 -f
```

Portfolio runs as a standalone Next.js SSR container (`portfolio-app:3000`), proxied by NPM.

---

## n8n Database Management

```bash
# Connect to DB
docker exec -it n8n-postgres psql -U n8n_admin -d n8n

# Backup
docker exec n8n-postgres pg_dump -U n8n_admin n8n > /tmp/n8n-db-$(date +%Y%m%d).sql

# Restore (credentials in docker-compose.yml env vars)
docker exec -i n8n-postgres psql -U n8n_admin -d n8n < /tmp/n8n-db-[DATE].sql

# Reset n8n user/owner (removes login prompts)
docker exec -i n8n-postgres psql -U n8n_admin -d n8n -c "DELETE FROM \"user\";"
docker compose restart n8n-app
```

---

## Log Access

| Service | Command |
|---------|---------|
| Frigate NVR | `docker logs frigate --tail 100 -f` |
| n8n | `docker logs n8n-app --tail 100 -f` |
| Nginx Proxy Manager | `docker logs nginx-manager --tail 100 -f` |
| Portfolio | `docker logs portfolio-app --tail 100 -f` |
| Tailscale | `docker compose logs -f tailscale` |
| Cloudflare Tunnel | `journalctl -u cloudflared-tunnel.service -f` |
| Maintenance script | `tail -f /var/log/server-maintenance.log` |
| System syslog | `tail -f /var/log/syslog` |

```bash
# Portfolio access log (real-time with Cloudflare info)
docker exec nginx-manager tail -f /data/logs/portfolio_access.log

# All error logs
docker exec nginx-manager grep "ERROR:" /data/logs/*_error.log

# Filter by country
docker exec nginx-manager grep "Country: EG" /data/logs/portfolio_access.log
```

---

## Maintenance Script

Run manually at any time:
```bash
sudo /home/homeLab/scripts/server-maintenance.sh
tail -f /var/log/server-maintenance.log
```

Runs automatically: **every Sunday at 12:01 AM** (cron — root + sahragty).

Script covers package updates, cleanup, health checks, and security checks.

---

## Updating Services

```bash
cd /home/homeLab

# Pull latest images and recreate containers
docker compose pull
docker compose up -d

# Update cloudflared
wget -O /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i /tmp/cloudflared.deb
systemctl restart cloudflared-tunnel.service
cloudflared --version
```

---

## Backup Commands

```bash
# Full service data backup
tar -czf /tmp/homeLab-backup-$(date +%Y%m%d).tar.gz -C /home/homeLab/volumes/ .

# Cloudflare Tunnel credentials
tar -czf /tmp/cloudflare-backup-$(date +%Y%m%d).tar.gz /root/.cloudflared/

# n8n database backup
docker exec n8n-postgres pg_dump -U n8n_admin n8n > /tmp/n8n-db-$(date +%Y%m%d).sql

# Full restore
cd /home/homeLab && docker compose down
tar -xzf /tmp/homeLab-backup-[DATE].tar.gz -C /home/homeLab/volumes/
docker compose up -d
```
