# Tailscale Exit Node

**Container:** `tailscale-exit-node`  
**Image:** `tailscale/tailscale:latest`  
**Network Mode:** host (direct kernel networking)  
**Auth Key:** `.env.tailscale` (never committed)

---

## Purpose

Tailscale provides a WireGuard-based VPN exit node. When a remote device connects and selects this as the exit node, all its internet traffic routes through the homelab network and then through the Deeper VPN hardware.

```
Remote device (Tailscale client)
  → Tailscale network (WireGuard, E2E encrypted)
    → sahragty host (exit node)
      → Deeper VPN hardware
        → Internet
```

---

## Container Configuration

```yaml
image: tailscale/tailscale:latest
container_name: tailscale-exit-node
network_mode: host
restart: unless-stopped
env_file: .env.tailscale

environment:
  TS_USERSPACE: "false"         # Use kernel TUN device (faster, no NAT)
  TS_ROUTES: "0.0.0.0/0"       # Advertise as full exit node
  TS_EXTRA_ARGS: "--advertise-exit-node"

devices:
  - /dev/net/tun:/dev/net/tun

cap_add:
  - NET_ADMIN

deploy:
  resources:
    limits:
      memory: 128M
      cpus: "0.5"
```

**Why host networking?** Avoids Docker NAT. Traffic routes directly through the host kernel to the Deeper VPN hardware — no double-NAT.

**Why `TS_USERSPACE=false`?** Uses the Linux kernel VPN stack (TUN device) rather than userspace. Faster and integrates cleanly with the physical VPN router.

---

## Prerequisites

1. **Kernel IP forwarding** — enabled in `/etc/sysctl.d/99-tailscale.conf`
2. **Auth key** — stored in `/home/homeLab/.env.tailscale`:
   ```env
   TS_AUTHKEY=tskey-auth-...
   ```
   Generate at [Tailscale Admin → Keys](https://login.tailscale.com/admin/settings/keys).  
   Use: **Reusable** ✅ · **No expiry** ✅ · **Ephemeral** ❌

3. **Exit node approval** — one-time, in [Tailscale Admin → Machines](https://login.tailscale.com/admin/machines):  
   `sahragty → ⋯ → Edit route settings → Use as exit node → Save`

---

## Operations

### Start / Restart

```bash
cd /home/homeLab
docker compose up -d tailscale
docker compose logs tailscale
```

### Check Status

```bash
docker exec tailscale-exit-node tailscale status
```

### View Audit Logs

```bash
# Connected devices
tail -f /home/homeLab/volumes/tailscale-logs/audit-logs/connected-devices.log

# Network stats
tail -f /home/homeLab/volumes/tailscale-logs/traffic-stats/traffic-summary.log

# Full audit trail
tail -f /home/homeLab/volumes/tailscale-logs/audit-logs/access-audit.log
```

Logs are captured every 5 minutes by `/home/homeLab/scripts/tailscale-audit-logger.sh` (cron).

### Update

```bash
cd /home/homeLab
docker compose pull tailscale
docker compose up -d --no-deps tailscale
```

---

## Troubleshooting

### "Invalid key" after server reboot

Auth keys can expire or be invalidated on restart.

1. Generate a new key at [Tailscale Admin → Keys](https://login.tailscale.com/admin/settings/keys)
2. Update `/home/homeLab/.env.tailscale`
3. Restart: `docker compose restart tailscale`

### Reset auth state

```bash
rm -rf /home/homeLab/volumes/tailscale-data/*
docker compose restart tailscale
```

### Verify kernel forwarding

```bash
sysctl net.ipv4.ip_forward              # should be 1
sysctl net.ipv6.conf.all.forwarding     # should be 1
```

---

## Volumes

| Host Path | Purpose |
|-----------|---------|
| `./volumes/tailscale-data/` | Persistent auth state |
| `./volumes/tailscale-logs/` | Audit logs + traffic stats |

### Backup / Restore

```bash
# Backup auth state
tar -czf tailscale-backup-$(date +%Y%m%d).tar.gz /home/homeLab/volumes/tailscale-data/

# Restore
docker compose down tailscale
rm -rf /home/homeLab/volumes/tailscale-data/*
tar -xzf tailscale-backup-YYYYMMDD.tar.gz -C /home/homeLab/volumes/tailscale-data/
docker compose up -d tailscale
```

---

## Resource Usage

| Metric | Actual | Limit |
|--------|--------|-------|
| Memory | ~21 MB | 128 MB |
| CPU | <0.1 cores | 0.5 cores |

## Security Notes

- Never commit `.env.tailscale` — it's in `.gitignore`
- Rotate the auth key periodically: generate new → update `.env.tailscale` → restart container
- Exit node requires manual approval in the Tailscale console — only you can enable/disable it
