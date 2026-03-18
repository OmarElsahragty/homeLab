#!/bin/bash
# Tailscale Exit Node Audit Logger
# Captures device connections, access logs, and network activity
# Run periodically (cron) to maintain audit trail

set -e

LOG_DIR="/home/homeLab/volumes/tailscale-logs"
AUDIT_LOG="$LOG_DIR/audit-logs/access-audit.log"
DEVICES_LOG="$LOG_DIR/audit-logs/connected-devices.log"
TRAFFIC_LOG="$LOG_DIR/traffic-stats/traffic-summary.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TIMESTAMP_FILE=$(date '+%Y%m%d-%H%M%S')

# Ensure log directory exists
mkdir -p "$LOG_DIR"/{audit-logs,traffic-stats}

# ============================================================================
# 1. CAPTURE CONNECTED DEVICES
# ============================================================================
# Logs all currently connected Tailscale devices
log_connected_devices() {
    {
        echo "========================================"
        echo "Connected Devices @ $TIMESTAMP"
        echo "========================================"
        docker compose -f /home/homeLab/docker-compose.yml exec -T tailscale tailscale status 2>/dev/null || echo "Tailscale container not accessible"
        echo ""
    } >> "$DEVICES_LOG"
}

# ============================================================================
# 2. CAPTURE NETWORK STATISTICS
# ============================================================================
# Logs interface stats, bandwidth, and routing info
log_network_stats() {
    {
        echo "========================================"
        echo "Network Statistics @ $TIMESTAMP"
        echo "========================================"
        echo "=== Tailscale Interface Status ==="
        docker compose -f /home/homeLab/docker-compose.yml exec -T tailscale ip link show 2>/dev/null | grep -E 'tailscale|bytes|packets' || echo "Network info unavailable"
        echo ""
        echo "=== Docker Container Stats ==="
        docker stats --no-stream tailscale-exit-node 2>/dev/null | tail -1 || echo "Stats unavailable"
        echo ""
    } >> "$TRAFFIC_LOG"
}

# ============================================================================
# 3. CAPTURE CONTAINER LOGS (RECENT ACTIVITY)
# ============================================================================
# Extracts recent container logs showing access patterns
log_container_activity() {
    {
        echo "========================================"
        echo "Container Activity @ $TIMESTAMP"
        echo "========================================"
        docker compose -f /home/homeLab/docker-compose.yml logs --tail=50 tailscale 2>/dev/null | tail -20 || echo "Logs not accessible"
        echo ""
    } >> "$AUDIT_LOG"
}

# ============================================================================
# 4. CAPTURE KERNEL ROUTING STATUS
# ============================================================================
# Verify exit node routing is working
log_routing_status() {
    {
        echo "========================================"
        echo "Routing Status @ $TIMESTAMP"
        echo "========================================"
        echo "=== IP Forwarding ==="
        sysctl net.ipv4.ip_forward 2>/dev/null || echo "sysctl check skipped"
        sysctl net.ipv6.conf.all.forwarding 2>/dev/null || echo "IPv6 forwarding check skipped"
        echo ""
        echo "=== Exit Node Routes ==="
        docker compose -f /home/homeLab/docker-compose.yml exec -T tailscale ip route show 2>/dev/null | head -10 || echo "Route info unavailable"
        echo ""
    } >> "$AUDIT_LOG"
}

# ============================================================================
# 5. LOG EXIT NODE HEALTH
# ============================================================================
# Check container health and connectivity
log_health_status() {
    local container_status=$(docker ps --filter=name=tailscale-exit-node --format="{{.Status}}" 2>/dev/null)
    
    {
        echo "========================================"
        echo "Health Status @ $TIMESTAMP"
        echo "========================================"
        echo "Container Status: $container_status"
        
        # Check if container is running
        if [[ $container_status == Up* ]]; then
            echo "Status: ✅ HEALTHY"
        else
            echo "Status: ❌ UNHEALTHY"
        fi
        echo ""
    } >> "$AUDIT_LOG"
}

# ============================================================================
# 6. QUICK STATUS SUMMARY
# ============================================================================
# Brief summary of current state
log_summary() {
    local device_count=$(docker compose -f /home/homeLab/docker-compose.yml exec -T tailscale tailscale status 2>/dev/null | wc -l || echo "0")
    
    echo "[$TIMESTAMP] Exit Node Audit Logged - Devices: $((device_count - 1)), Logs: audit-logs, traffic-stats"
}

# ============================================================================
# EXECUTION
# ============================================================================
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Tailscale audit logging..."

log_connected_devices
log_network_stats
log_container_activity
log_routing_status
log_health_status
log_summary

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Audit logging complete"
echo "Log files:"
echo "  - Devices: $DEVICES_LOG"
echo "  - Audit: $AUDIT_LOG"
echo "  - Traffic: $TRAFFIC_LOG"
