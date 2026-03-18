# Networking Reference

---

## Network Interfaces

| Interface | IP | Subnet | Broadcast | State |
|-----------|-----|--------|-----------|-------|
| `enp3s0` | 192.168.1.212/24 | 255.255.255.0 | 192.168.1.255 | UP |
| `lo` | 127.0.0.1/8 | — | — | UP |

**Gateway:** 192.168.1.1  
**DHCP:** Yes (ISP-assigned on `enp3s0`)

---

## DNS Resolvers

| Priority | Server | Provider |
|----------|--------|----------|
| Primary | 8.8.8.8 | Google DNS |
| Fallback | 1.1.1.1 | Cloudflare DNS |
| Gateway | 192.168.1.1 | Router |
| ISP | 163.121.128.134 / .135 | ISP |

---

## Domain & DNS

**Domain:** sahragty.me  
**Registrar / DNS:** Cloudflare  
**Zone ID:** `<REDACTED>` *(see Cloudflare dashboard)*  
**Nameservers:** amber.ns.cloudflare.com, eric.ns.cloudflare.com

### DNS Records

| Name | Type | Content | Purpose |
|------|------|---------|---------|
| `sahragty.me` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Routes to Cloudflare Tunnel |
| `*.sahragty.me` | CNAME | `<TUNNEL_ID>.cfargotunnel.com` | Wildcard for all subdomains |

### Active Subdomains

| Subdomain | Service | Auth |
|-----------|---------|------|
| `sahragty.me` | Portfolio | None (public) |
| `nvr.sahragty.me` | Frigate NVR | HTTP Basic Auth |
| `n8n.sahragty.me` | n8n Automation | HTTP Basic Auth |

---

## Cloudflare Tunnel

### Why Cloudflare Tunnel?

| Feature | Port Forwarding + DDNS | Cloudflare Tunnel |
|---------|------------------------|-------------------|
| Public IP exposure | Visible in DNS | Hidden |
| Port forwarding | Required (80, 443) | Not needed |
| DDNS maintenance | Required | Not needed |
| ISP port blocking | Vulnerable | Immune |
| DDoS protection | Limited | Full Cloudflare |
| IP changes | Requires update | Seamless |

### Tunnel Configuration

| Field | Value |
|-------|-------|
| Tunnel Name | `homelab-sahragty` |
| Tunnel ID | `<REDACTED>` *(see Cloudflare dashboard)* |
| Binary | `/usr/local/bin/cloudflared` |
| Version | 2026.2.0 |
| Protocol | QUIC |
| Connections | 4 persistent (to Cloudflare edge DCs) |

**Files:**
| File | Path |
|------|------|
| Origin certificate | `/root/.cloudflared/cert.pem` |
| Credentials | `/root/.cloudflared/<TUNNEL_ID>.json` |
| Config | `/root/.cloudflared/config.yml` |
| Systemd service | `/etc/systemd/system/cloudflared-tunnel.service` |

### Ingress Rules (`/root/.cloudflared/config.yml`)

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: sahragty.me
    service: http://localhost:80
  - hostname: "*.sahragty.me"
    service: http://localhost:80
  - service: http_status:404
```

### Cloudflare API Credentials

> **All credentials stored securely — see Cloudflare dashboard for values.**

| Field | Value |
|-------|-------|
| Account ID | `<REDACTED>` |
| Zone ID | `<REDACTED>` |
| API Token | `<REDACTED>` *(DNS edit scope)* |

> **Note:** Tunnel authentication uses origin certificate (`cert.pem`), not the API token.

### Management Commands

```bash
# Tunnel status
systemctl status cloudflared-tunnel.service
journalctl -u cloudflared-tunnel.service -n 50 -f

# Restart tunnel
systemctl restart cloudflared-tunnel.service

# Verify tunnel
cloudflared tunnel list
cloudflared tunnel info homelab-sahragty
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://sahragty.me
```

---

## SSL/TLS

All HTTPS is terminated at **Cloudflare's edge**. NPM runs HTTP-only mode, receiving decrypted traffic from cloudflared.

| Layer | Component | Role |
|-------|-----------|------|
| Edge (internet-facing) | Cloudflare Universal SSL | TLS 1.2/1.3 termination |
| Tunnel | cloudflared QUIC | Encrypted transport to server |
| Server-internal | NPM (HTTP only) | Routes plaintext to services |
| Services | Docker containers | No TLS needed |

**No certificates are managed on the server.** Auto-renewal is automatic via Cloudflare.

---

## Ports

### External (LAN-accessible)

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH (sshd) |
| 81 | TCP | NPM Admin UI |
| 139 | TCP | NetBIOS (smbd) |
| 445 | TCP | SMB (smbd) |

### Internal (localhost only — proxied by NPM)

| Port | Service | Proxied As |
|------|---------|------------|
| 80 | Nginx Proxy Manager | All subdomains (via tunnel) |
| 3000 | Portfolio (Next.js SSR) | sahragty.me |
| 5000 | Frigate NVR | nvr.sahragty.me |
| 8000 | n8n | n8n.sahragty.me |

**Security design:** All service ports bind to `127.0.0.1`. Cloudflare Tunnel → NPM is the only path in from the internet. No router port forwarding required.

### Port Verification

```bash
# Check all listening ports
sudo ss -tlnp

# Verify localhost-only binding
sudo ss -tlnp | grep -E "5000|8000"
```

---

## Docker Networks

| Network | Subnet | Driver | Purpose |
|---------|--------|--------|---------|
| `nginx-network` | external (bridge) | bridge | Shared proxy layer |
| `n8n_network` | 172.25.0.0/16 | bridge | Isolated n8n ↔ postgres |
| `bridge` (default) | 172.17.0.0/16 | bridge | Docker default (unused by services) |

> **Note:** Tailscale uses `network_mode: host` — it operates directly on the host network stack, not through Docker networks.

### Docker Network Commands

```bash
docker network ls
docker network inspect nginx-network
docker network inspect n8n_network
```

---

## Traffic Flow Diagram

```
Internet (HTTPS request)
    │
    ▼
Cloudflare Edge
  ├── TLS termination (Universal SSL)
  ├── DDoS protection
  └── Routes to tunnel via QUIC
    │
    ▼
cloudflared daemon (Ubuntu 24.04 server)
  └── 4 QUIC connections to Cloudflare edge DCs
    │
    ▼
Nginx Proxy Manager (127.0.0.1:80 — HTTP only)
  ├── sahragty.me         → portfolio-app:3000 (Next.js SSR)
  ├── nvr.sahragty.me     → frigate:5000       [Basic Auth]
  └── n8n.sahragty.me     → 127.0.0.1:8000    [Basic Auth]
    │
    ▼
Docker Service (container)
```
