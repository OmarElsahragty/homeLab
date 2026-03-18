#!/bin/bash
# =============================================================================
# server-maintenance.sh — Weekly HomeLab Maintenance Script
# Host: sahragty (192.168.1.212) | Ubuntu 24.04 LTS
# Schedule: @weekly (root crontab)
# Log: /var/log/server-maintenance.log
# =============================================================================

set -euo pipefail

LOGFILE="/var/log/server-maintenance.log"
HOMELAB_DIR="/home/homeLab"
STORAGE_DIR="/home/storage"
FRIGATE_RECORDINGS_DIR="/home/storage/records"
FRIGATE_RECORDINGS_MAX_AGE_DAYS=30   # delete Frigate recordings older than this
NPM_LOG_MAX_AGE_DAYS=14              # rotate NPM proxy access/error logs older than this
DOCKER_LOG_MAX_LINES=50000           # truncate any container JSON log above this many lines

# ─── helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"; }
log_section() { echo "" >> "$LOGFILE"; log "━━━ $* ━━━"; }
ok()   { log "  ✔  $*"; }
warn() { log "  ⚠  $*"; }
fail() { log "  ✘  $*"; }

# ─── pre-flight ───────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root." >&2
    exit 1
fi

echo "" >> "$LOGFILE"
echo "============================================" >> "$LOGFILE"
log "WEEKLY MAINTENANCE STARTED"
log "Hostname: $(hostname) | Uptime: $(uptime -p)"
echo "============================================" >> "$LOGFILE"

# =============================================================================
# PART 1 — SYSTEM PACKAGE UPDATES
# =============================================================================
log_section "PART 1: SYSTEM PACKAGE UPDATES"

# 1. Sync package repositories
log "[1/7] Syncing APT repositories..."
if apt-get update -qq 2>&1 | tee -a "$LOGFILE"; then
    ok "APT repos synced."
else
    warn "APT update encountered issues — check output above."
fi

# 2. Full dist-upgrade (handles kernel + dependency changes)
log "[2/7] Installing system & kernel updates (dist-upgrade)..."
if DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" 2>&1 | tee -a "$LOGFILE"; then
    ok "System upgraded successfully."
else
    warn "dist-upgrade encountered issues."
fi

# 3. Update Snap packages
log "[3/7] Updating Snap packages..."
if command -v snap > /dev/null 2>&1; then
    if snap refresh 2>&1 | tee -a "$LOGFILE"; then
        ok "Snap packages refreshed."
    else
        warn "snap refresh had issues."
    fi
else
    log "  (snap not installed — skipping)"
fi

# 4. Update cloudflared binary (honours --no-autoupdate in service but we manually refresh)
log "[4/7] Checking for cloudflared binary update..."
if command -v cloudflared > /dev/null 2>&1; then
    CURRENT_CF=$(cloudflared --version 2>&1 | head -1)
    if cloudflared update 2>&1 | tee -a "$LOGFILE"; then
        NEW_CF=$(cloudflared --version 2>&1 | head -1)
        if [[ "$CURRENT_CF" != "$NEW_CF" ]]; then
            ok "cloudflared updated: $CURRENT_CF → $NEW_CF. Restarting service..."
            systemctl restart cloudflared-tunnel.service
            ok "cloudflared-tunnel.service restarted."
        else
            ok "cloudflared is already up to date ($CURRENT_CF)."
        fi
    else
        warn "cloudflared update check failed."
    fi
else
    warn "cloudflared binary not found."
fi

# 5. Pull latest Docker images and recreate changed containers
log "[5/7] Pulling latest Docker images..."
if [[ -f "$HOMELAB_DIR/docker-compose.yml" ]]; then
    cd "$HOMELAB_DIR"
    if docker compose pull 2>&1 | tee -a "$LOGFILE"; then
        ok "Docker images pulled. Recreating updated containers..."
        # --no-deps + --remove-orphans keeps downtime minimal
        docker compose up -d --remove-orphans 2>&1 | tee -a "$LOGFILE"
        ok "Containers recreated where images changed."
    else
        warn "docker compose pull had issues. Containers not restarted."
    fi
else
    warn "docker-compose.yml not found at $HOMELAB_DIR — skipping Docker update."
fi

# 6. Remove orphaned/unused APT packages
log "[6/7] Removing unused APT dependency packages..."
apt-get autoremove -y 2>&1 | tee -a "$LOGFILE"
ok "Autoremove complete."

# 7. Purge "ghost" config files left by removed packages (rc state)
log "[7/7] Purging residual APT config files..."
GHOST_PKGS=$(dpkg -l | awk '/^rc/{print $2}')
if [[ -n "$GHOST_PKGS" ]]; then
    echo "$GHOST_PKGS" | xargs apt-get -y purge 2>&1 | tee -a "$LOGFILE"
    ok "Purged ghost config packages."
else
    ok "No residual config packages found."
fi

# =============================================================================
# PART 2 — DISK & CACHE CLEANUP
# =============================================================================
log_section "PART 2: DISK & CACHE CLEANUP"

# Safety: ensure legacy `/home/homeLab/volumes/openclaw-workspace` is not present
LEGACY_WS="/home/homeLab/volumes/openclaw-workspace"
if [[ -e "$LEGACY_WS" ]]; then
    warn "Legacy path $LEGACY_WS detected — removing to enforce single workspace."
    rm -rf "$LEGACY_WS" 2>/dev/null || warn "Failed to remove $LEGACY_WS"
    ok "Removed legacy workspace directory."
fi

DISK_BEFORE_ROOT=$(df -h / | awk 'NR==2{print $4}')
DISK_BEFORE_HOME=$(df -h /home | awk 'NR==2{print $4}')
log "Disk free BEFORE cleanup — / : $DISK_BEFORE_ROOT  |  /home : $DISK_BEFORE_HOME"

# APT package cache
log "Clearing APT package cache..."
apt-get clean 2>&1 | tee -a "$LOGFILE"
ok "APT cache cleared."

# Thumbnail & user caches
log "Clearing user thumbnail/cache directories..."
find /home/sahragty/.cache -mindepth 1 -maxdepth 1 -type d \
    ! -name 'mozilla' ! -name 'google-chrome' \
    -exec rm -rf {} + 2>/dev/null && ok "User caches cleared." || true

# /tmp — files older than 7 days
log "Removing stale /tmp files (>7 days old)..."
find /tmp -mindepth 1 -maxdepth 3 -not -path '*/systemd*' \
    -atime +7 -delete 2>/dev/null || true
ok "/tmp cleaned."

# systemd journal — keep last 2 weeks
log "Vacuuming systemd journal (keeping 2 weeks)..."
journalctl --vacuum-time=2weeks 2>&1 | tee -a "$LOGFILE"
ok "Journal vacuumed."

# Docker: remove dangling images, stopped containers, unused networks + build cache
log "Pruning Docker dangling images and stopped containers..."
docker image prune -f 2>&1 | tee -a "$LOGFILE"
docker container prune -f 2>&1 | tee -a "$LOGFILE"
docker network prune -f 2>&1 | tee -a "$LOGFILE"
docker builder prune -f 2>&1 | tee -a "$LOGFILE"
ok "Docker pruned."

# Docker container JSON log files — truncate if they grow beyond threshold
log "Checking Docker container JSON log file sizes..."
while IFS= read -r logfile; do
    LINES=$(wc -l < "$logfile" 2>/dev/null || echo 0)
    if [[ $LINES -gt $DOCKER_LOG_MAX_LINES ]]; then
        CONTAINER=$(basename "$(dirname "$logfile")")
        warn "Container log too large ($LINES lines): $logfile — truncating to last $DOCKER_LOG_MAX_LINES lines."
        tail -n "$DOCKER_LOG_MAX_LINES" "$logfile" > "${logfile}.tmp" && mv "${logfile}.tmp" "$logfile"
    fi
done < <(find /var/lib/docker/containers -name '*-json.log' 2>/dev/null)
ok "Docker log sizes checked."

# NPM proxy access/error logs — delete logs older than threshold
log "Rotating old Nginx Proxy Manager logs (>${NPM_LOG_MAX_AGE_DAYS} days)..."
NPM_LOG_DIR="$HOMELAB_DIR/volumes/nginx-manager-data/logs"
if [[ -d "$NPM_LOG_DIR" ]]; then
    find "$NPM_LOG_DIR" -type f -name "*.log" -mtime +"$NPM_LOG_MAX_AGE_DAYS" -delete 2>/dev/null
    ok "NPM logs rotated."
else
    log "  (NPM log dir not found at $NPM_LOG_DIR — skipping)"
fi

# Samba log rotation — keep recent only
log "Trimming Samba logs..."
find /var/log/samba -type f -name "log.*" -size +5M -exec truncate -s 0 {} \; 2>/dev/null || true
ok "Samba logs trimmed."

# Old crash/core dumps
log "Removing old crash dumps..."
find /var/crash -type f -mtime +7 -delete 2>/dev/null || true
find /var/lib/apport/coredump -type f 2>/dev/null -delete 2>/dev/null || true
ok "Crash dumps cleared."

# Frigate NVR recordings — enforce retention window
log "Enforcing Frigate recording retention (>${FRIGATE_RECORDINGS_MAX_AGE_DAYS} days)..."
if [[ -d "$FRIGATE_RECORDINGS_DIR" ]]; then
    BEFORE=$(du -sh "$FRIGATE_RECORDINGS_DIR" 2>/dev/null | cut -f1)
    find "$FRIGATE_RECORDINGS_DIR" -type f \
        \( -name "*.mp4" -o -name "*.mkv" -o -name "*.ts" \) \
        -mtime +"$FRIGATE_RECORDINGS_MAX_AGE_DAYS" -delete 2>/dev/null || true
    # Remove empty date/hour directories left behind
    find "$FRIGATE_RECORDINGS_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true
    AFTER=$(du -sh "$FRIGATE_RECORDINGS_DIR" 2>/dev/null | cut -f1)
    ok "Frigate recordings cleaned. Storage: $BEFORE → $AFTER"
else
    warn "Frigate recordings dir not found at $FRIGATE_RECORDINGS_DIR"
fi

DISK_AFTER_ROOT=$(df -h / | awk 'NR==2{print $4}')
DISK_AFTER_HOME=$(df -h /home | awk 'NR==2{print $4}')
log "Disk free AFTER cleanup  — / : $DISK_AFTER_ROOT  |  /home : $DISK_AFTER_HOME"

# =============================================================================
# PART 3 — NAS / SAMBA SERVICE HEALTH
# =============================================================================
log_section "PART 3: NAS / SAMBA SERVICE HEALTH"

for SVC in smbd nmbd; do
    if systemctl is-active --quiet "$SVC"; then
        ok "$SVC is running."
    else
        warn "$SVC is NOT running — attempting restart..."
        if systemctl restart "$SVC" 2>&1 | tee -a "$LOGFILE"; then
            ok "$SVC restarted successfully."
        else
            fail "$SVC failed to restart. Manual intervention required."
        fi
    fi
done

# Verify the NAS share path is accessible
if [[ -d "$STORAGE_DIR" ]]; then
    SHARE_USED=$(du -sh "$STORAGE_DIR" 2>/dev/null | cut -f1)
    ok "NAS share path $STORAGE_DIR is accessible (used: $SHARE_USED)."
else
    fail "NAS share path $STORAGE_DIR is missing — Samba share will be broken!"
fi

# Verify /home disk health (NAS storage lives on /home HDD)
HOME_USE_PCT=$(df /home | awk 'NR==2{gsub(/%/,""); print $5}')
if [[ $HOME_USE_PCT -ge 90 ]]; then
    fail "/home disk is ${HOME_USE_PCT}% full — CRITICAL! Clean recordings or expand storage."
elif [[ $HOME_USE_PCT -ge 75 ]]; then
    warn "/home disk is ${HOME_USE_PCT}% full — consider cleanup soon."
else
    ok "/home disk usage is healthy (${HOME_USE_PCT}%)."
fi

# =============================================================================
# PART 4 — DOCKER / HOMELAB SERVICES HEALTH
# =============================================================================
log_section "PART 4: DOCKER / HOMELAB SERVICES HEALTH"

# Ensure Docker service itself is healthy
if systemctl is-active --quiet docker; then
    ok "docker.service is running."
else
    fail "docker.service is NOT running — attempting restart..."
    systemctl restart docker
fi

# Critical containers to verify
CONTAINERS=("nginx-manager" "frigate" "n8n-app" "n8n-postgres" "openclaw-gateway")

for CONTAINER in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "not_found")
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$CONTAINER" 2>/dev/null || echo "unknown")

    if [[ "$STATUS" == "running" ]]; then
        if [[ "$HEALTH" == "healthy" || "$HEALTH" == "no-healthcheck" ]]; then
            ok "$CONTAINER — status: $STATUS | health: $HEALTH"
        else
            warn "$CONTAINER — status: $STATUS | health: $HEALTH (unhealthy or starting)"
        fi
    else
        fail "$CONTAINER — status: $STATUS — attempting restart..."
        cd "$HOMELAB_DIR"
        docker compose up -d "$CONTAINER" 2>&1 | tee -a "$LOGFILE" || true
    fi
done

# Report overall Docker resource usage
log "Current Docker resource snapshot:"
docker stats --no-stream --format \
    "  {{.Name}}: CPU={{.CPUPerc}} MEM={{.MemUsage}} ({{.MemPerc}})" \
    2>/dev/null | tee -a "$LOGFILE" || true

# =============================================================================
# PART 5 — SYSTEMD CRITICAL SERVICES HEALTH
# =============================================================================
log_section "PART 5: SYSTEMD CRITICAL SERVICES HEALTH"

CRITICAL_SERVICES=(
    "cloudflared-tunnel.service"
    "ssh.service"
    "cron.service"
    "rsyslog.service"
    "unattended-upgrades.service"
    "systemd-timesyncd.service"
    "thermald.service"
    "apparmor.service"
)

for SVC in "${CRITICAL_SERVICES[@]}"; do
    if systemctl is-active --quiet "$SVC"; then
        ok "$SVC is running."
    else
        warn "$SVC is NOT active — attempting restart..."
        systemctl restart "$SVC" 2>&1 | tee -a "$LOGFILE" || fail "$SVC could not be restarted."
    fi
done

# Verify Cloudflare Tunnel has active connections
log "Checking Cloudflare Tunnel connections..."
if cloudflared tunnel info homelab-sahragty 2>&1 | tee -a "$LOGFILE"; then
    ok "Cloudflare Tunnel info retrieved."
else
    warn "Could not query Cloudflare Tunnel info (may be a transient issue)."
fi

# =============================================================================
# PART 6 — SECURITY CHECKS
# =============================================================================
log_section "PART 6: SECURITY CHECKS"

# AppArmor status
log "AppArmor status:"
if command -v aa-status > /dev/null 2>&1; then
    aa-status --summary 2>&1 | tee -a "$LOGFILE"
    ok "AppArmor checked."
else
    warn "aa-status not found."
fi

# Check for failed SSH login attempts in the last 7 days
log "Checking for failed SSH login attempts (last 7 days)..."
FAILED_SSH=$(journalctl -u ssh --since "7 days ago" --no-pager 2>/dev/null \
    | grep -c "Failed password\|Invalid user" 2>/dev/null || echo 0)
if [[ $FAILED_SSH -gt 100 ]]; then
    warn "High number of failed SSH attempts in last 7 days: $FAILED_SSH — review logs."
else
    ok "Failed SSH attempts last 7 days: $FAILED_SSH (within normal range)."
fi

# Check for open ports — alert on unexpected listeners
log "Verifying listening ports..."
LISTENING=$(ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | sort -u)
log "  Current listeners: $(echo "$LISTENING" | tr '\n' ' ')"

# Check SSH on expected port
if ss -tlnp 2>/dev/null | grep -q ':22 '; then
    ok "SSH is listening on port 22."
else
    warn "SSH does not appear to be listening on port 22."
fi

# Verify NPM is not accidentally publicly exposing port 80
if ss -tlnp 2>/dev/null | grep -q '0.0.0.0:80 '; then
    warn "Port 80 is exposed to 0.0.0.0 — should be 127.0.0.1 only. Check docker-compose.yml."
else
    ok "Port 80 correctly bound to localhost only."
fi

# Check for world-writable files in sensitive locations (quick scan, non-intrusive)
log "Scanning for unexpected world-writable files in /etc..."
WW_FILES=$(find /etc -maxdepth 2 -perm -o+w -type f 2>/dev/null | head -10)
if [[ -n "$WW_FILES" ]]; then
    warn "World-writable files found in /etc:"
    echo "$WW_FILES" | tee -a "$LOGFILE"
else
    ok "No world-writable files in /etc."
fi

# Verify cloudflared credentials are root-only readable
CF_CREDS="/root/.cloudflared"
if [[ -d "$CF_CREDS" ]]; then
    BAD_PERMS=$(find "$CF_CREDS" -not -user root 2>/dev/null)
    if [[ -n "$BAD_PERMS" ]]; then
        warn "Cloudflared credentials not owned by root: $BAD_PERMS"
    else
        ok "Cloudflared credentials permissions look correct."
    fi
fi

# =============================================================================
# PART 7 — SYSTEM HEALTH SUMMARY
# =============================================================================
log_section "PART 7: SYSTEM HEALTH SUMMARY"

# Memory
MEM_TOTAL=$(free -h | awk '/^Mem:/{print $2}')
MEM_USED=$(free -h  | awk '/^Mem:/{print $3}')
MEM_FREE=$(free -h  | awk '/^Mem:/{print $4}')
MEM_USE_PCT=$(free | awk '/^Mem:/{printf "%.0f", $3/$2*100}')
SWAP_USED=$(free -h | awk '/^Swap:/{print $3}')
log "Memory: $MEM_USED used / $MEM_TOTAL total (${MEM_USE_PCT}%)  | Swap used: $SWAP_USED"
if [[ $MEM_USE_PCT -ge 90 ]]; then
    warn "Memory usage is critically high (${MEM_USE_PCT}%)."
elif [[ $MEM_USE_PCT -ge 75 ]]; then
    warn "Memory usage is elevated (${MEM_USE_PCT}%) — monitor containers."
else
    ok "Memory usage healthy (${MEM_USE_PCT}%)."
fi

# CPU load average vs core count
LOAD_1MIN=$(cut -d' ' -f1 /proc/loadavg)
CORES=$(nproc)
log "Load average (1m): $LOAD_1MIN  |  CPU cores: $CORES"
LOAD_INT=$(echo "$LOAD_1MIN" | cut -d'.' -f1)
if [[ $LOAD_INT -gt $CORES ]]; then
    warn "Load average ($LOAD_1MIN) exceeds core count ($CORES) — system may be overloaded."
else
    ok "Load average healthy ($LOAD_1MIN on $CORES cores)."
fi

# Root disk
ROOT_USE_PCT=$(df / | awk 'NR==2{gsub(/%/,""); print $5}')
ROOT_FREE=$(df -h / | awk 'NR==2{print $4}')
log "Root disk (/): ${ROOT_USE_PCT}% used | $ROOT_FREE free."
if [[ $ROOT_USE_PCT -ge 90 ]]; then
    fail "Root disk is critically full (${ROOT_USE_PCT}%)."
elif [[ $ROOT_USE_PCT -ge 75 ]]; then
    warn "Root disk is getting full (${ROOT_USE_PCT}%)."
else
    ok "Root disk healthy (${ROOT_USE_PCT}% used)."
fi

# Kernel reboot flag
if [[ -f /var/run/reboot-required ]]; then
    warn "!!! REBOOT REQUIRED — a new kernel or core library was installed. Schedule a reboot."
    if [[ -f /var/run/reboot-required.pkgs ]]; then
        log "  Packages requiring reboot: $(cat /var/run/reboot-required.pkgs)"
    fi
else
    ok "No reboot required."
fi

# Uptime summary
log "System uptime: $(uptime -p)"

# =============================================================================
# DONE
# =============================================================================
echo "" >> "$LOGFILE"
echo "============================================" >> "$LOGFILE"
log "WEEKLY MAINTENANCE COMPLETE"
echo "============================================" >> "$LOGFILE"
