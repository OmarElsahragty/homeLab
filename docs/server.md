# HomeLab Server — Complete Reference

**Hostname:** sahragty  
**Domain:** sahragty.me  
**Owner:** Omar Elsahragty  
**Local IP:** 192.168.1.212  
**Public IP:** Dynamic DHCP (hidden behind Cloudflare Tunnel)  
**Last Updated:** March 18, 2026  
**OS:** Ubuntu 24.04.3 LTS (Noble Numbat) — Kernel 6.8.0-94-generic  
**Timezone:** Africa/Cairo  

---

## Hardware

| Component | Details |
|-----------|---------|
| CPU | Intel Core i5-8300H @ 2.30 GHz (Turbo 4.0 GHz), 4 cores / 8 threads |
| RAM | 16 GiB DDR4 (15 GiB usable) |
| Swap | 8 GiB (`/swapfile`) |
| GPU | Intel UHD Graphics 630 (CoffeeLake-H GT2) |
| System Disk | NVMe SSD — 231 GB (`/dev/nvme0n1p3`, mounted `/`) |
| Data Disk | HDD — 440 GB (`/dev/sda1`, mounted `/home`) |

**Typical usage:** RAM ~3–5 GiB / 12 GiB available · System disk ~41 GB used (19%) · Data disk ~15 GB used (4%)

---

## Storage

| Device | Mount | Size | Used | Type |
|--------|-------|------|------|------|
| `/dev/nvme0n1p3` | `/` | 231 GB | 41 GB (19%) | NVMe SSD |
| `/dev/sda1` | `/home` | 440 GB | 15 GB (4%) | HDD |
| `/swapfile` | swap | 8 GB | ~0 | File |

### /home directory

| Directory | Size | Purpose |
|-----------|------|---------|
| `/home/storage/` | 14 GB | Frigate NVR recordings (NAS share) |
| `/home/homeLab/portfolio/` | 275 MB | Next.js portfolio source + Docker build |
| `/home/sahragty/` | 173 MB | User home directory |
| `/home/n8n/` | 94 MB | n8n workflows + PostgreSQL data (legacy path) |
| `/home/frigate/` | 61 MB | Frigate config + model cache (legacy path) |
| `/home/nginx-manager/` | 1.5 MB | NPM config, data, SSL certs (legacy path) |

> **Current volume paths:** All service data is now unified under `/home/homeLab/volumes/`. Legacy paths above may still exist as symlinks or old mount points.

---

## User Accounts

| Username | UID | Purpose | Shell | Notes |
|----------|-----|---------|-------|-------|
| `root` | 0 | Primary admin | /bin/bash | Runs all services and cron jobs |
| `sahragty` | 1001 | Secondary admin | /bin/bash | Development, script testing, fallback cron |
| `user` | 1000 | SSH access only | /bin/sh | **Testing only — no cron, no automation** |

---

## Systemd Services

### Running Services

| Service | Description | Memory |
|---------|-------------|--------|
| `cloudflared-tunnel.service` | Cloudflare Tunnel (4 QUIC connections) | ~18–20 MB |
| `docker.service` | Docker container engine | — |
| `containerd.service` | Container runtime | — |
| `ssh.service` | OpenSSH server (port 22) | — |
| `cron.service` | Job scheduler | — |
| `rsyslog.service` | System logging | — |
| `smbd.service` / `nmbd.service` | Samba file sharing | — |
| `thermald.service` | CPU thermal management | — |
| `unattended-upgrades.service` | Daily security patches | — |
| `apparmor.service` | Mandatory access control | — |

### Cloudflare Tunnel Service

```ini
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run homelab-sahragty
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl status cloudflared-tunnel.service
journalctl -u cloudflared-tunnel.service -f
systemctl restart cloudflared-tunnel.service
cloudflared tunnel info homelab-sahragty
```

### Services Removed (Optimization)

| Service | Reason |
|---------|--------|
| `fail2ban.service` | Hardware firewall provides protection |
| `atop.service` | Unnecessary monitoring overhead |
| `ModemManager.service` | No modem hardware |
| `wpa_supplicant.service` | Ethernet only, no WiFi |
| `multipathd.service` | No multipath storage |
| `frigate.service` | Redundant — Docker restart policy handles it |
| `n8n.service` | Redundant — Docker restart policy handles it |

---

## Samba File Sharing

| Setting | Value |
|---------|-------|
| Share Name | `local-storage` |
| Path | `/home/storage` |
| Read Only | No |
| Guest Access | Yes (no password) |
| Create Mask | 0664 |
| Directory Mask | 0775 |
| Force User | root |
| Ports | 139 (NetBIOS), 445 (SMB) |

**Access:**
```
smb://192.168.1.212/local-storage    (macOS/Linux)
\\192.168.1.212\local-storage        (Windows)
```

---

## Cron Jobs & Scheduled Tasks

### Custom Cron Jobs

| Schedule | Owner | Script | Purpose |
|----------|-------|--------|---------|
| `@weekly` (Sun 12:01 AM) | root | `server-maintenance.sh` | Weekly maintenance |
| `@weekly` (Sun 12:01 AM) | sahragty | `server-maintenance.sh` | Fallback maintenance |

**Log:** `/var/log/server-maintenance.log`

### Maintenance Script Parts (`/home/homeLab/scripts/server-maintenance.sh`)

1. **System package updates** — APT, snap, cloudflared, Docker images
2. **Disk & cache cleanup** — APT cache, /tmp, journal vacuum, Docker prune, log rotation, Frigate recording retention (30 days)
3. **NAS/Samba health** — smbd/nmbd health + auto-restart, disk usage alerts (75%/90%)
4. **Docker services health** — Container status checks, auto-restart unhealthy containers
5. **Systemd critical services** — cloudflared, ssh, cron, rsyslog health + auto-restart
6. **Security checks** — AppArmor, failed SSH login alerts (>100 in 7 days), port audit, world-writable scan
7. **System health summary** — Memory, CPU, disk, kernel reboot check, uptime report

### System-Wide Cron Schedule

```
03:10 AM    e2scrub_all         - Filesystem scan (daily)
03:30 AM    e2scrub_all         - Filesystem check (Sunday)
06:25 AM    cron.daily          - APT updates, logrotate, man-db
06:47 AM    geoipupdate         - GeoIP database update (Wednesdays)
06:47 AM    cron.weekly         - Weekly scripts (Sundays)
11:59 PM    sysstat             - Daily statistics rotation
Every 10m   sysstat             - System activity collection
12:01 AM    server-maintenance.sh - HomeLab maintenance (Sundays)
```

---

## Backup & Recovery

### Backup Paths

| Data | Host Path | Notes |
|------|-----------|-------|
| All service volumes | `/home/homeLab/volumes/` | Unified location — backup this directory |
| Cloudflare Tunnel credentials | `/root/.cloudflared/` | Keep cert.pem + credentials JSON |
| Frigate recordings | `/home/storage/records/` | Auto-managed retention (30 days) |
| Portfolio source | `/home/homeLab/portfolio/` | Git-tracked |
| Compose file | `/home/homeLab/docker-compose.yml` | Git-tracked |

### Backup Commands

```bash
# Full service volumes backup
tar -czf homeLab-backup-$(date +%Y%m%d).tar.gz -C /home/homeLab/volumes/ .

# n8n database dump
docker exec n8n-postgres pg_dump -U n8n_admin n8n > /tmp/n8n-db-$(date +%Y%m%d).sql

# Cloudflare Tunnel credentials
tar -czf cloudflare-backup-$(date +%Y%m%d).tar.gz /root/.cloudflared/
```

### Restore

```bash
# Stop all services
cd /home/homeLab && docker compose down

# Restore volumes
tar -xzf homeLab-backup-[DATE].tar.gz -C /home/homeLab/volumes/

# Restart services
cd /home/homeLab && docker compose up -d
```

---

## System Optimization History

### v5.4.0 — February 18, 2026
- Unified all service documentation into single README (previously scattered)

### v5.3.1 — February 18, 2026
- User accounts documentation clarified
- `user` account explicitly documented as SSH-testing-only

### v5.3.0 — February 18, 2026 — Docker Compose Resource Optimization

| Service | Memory Before | Memory After | Savings |
|---------|---------------|--------------|---------|
| frigate | 12 GB | 6 GB | 50% |
| n8n-app | 2 GB | 512 MB | 75% |
| n8n-postgres | 1 GB | 512 MB | 50% |
| **Total** | **15 GB** | **7 GB** | **53%** |

CPU also optimized: 2–3 cores freed for system/host use. Health check intervals loosened to reduce overhead.

### v5.2.0 — February 18, 2026
- Renamed log files to match domain names

### v5.1.0 — February 18, 2026
- Enhanced Nginx logging with Cloudflare analytics (CF-Connecting-IP, CF-IPCountry, CF-RAY)
- Separate error logs for 4xx/5xx requests
- Real client IP logging (not Cloudflare edge IPs)

### v5.0.0 — February 18, 2026 — Cloudflare Tunnel Migration
- Removed DDNS system entirely (288 API calls/day → 0)
- Installed cloudflared v2026.2.0
- Created `homelab-sahragty` tunnel
- Replaced A records with CNAME → tunnel
- NPM optimized: SSL removed, HTTP-only mode, port 80 bound to localhost only

### v4.0.0 — February 18, 2026
- Removed fail2ban, atop, ModemManager, wpa_supplicant, multipathd
- Standardized Docker restart policy to `unless-stopped`
- Removed redundant systemd units (frigate.service, n8n.service)
