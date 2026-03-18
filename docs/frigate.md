# Frigate NVR

**URL:** https://nvr.sahragty.me  
**Auth:** HTTP Basic Auth (credentials in security.md)  
**Container:** `frigate`  
**Image:** `ghcr.io/blakeblackshear/frigate:stable`  
**Config:** `/home/homeLab/volumes/frigate-config/config.yaml`  
**Recordings:** `/home/storage/records/`

---

## Table of Contents

1. [Purpose](#purpose)
2. [Container Configuration](#container-configuration)
3. [Hardware Acceleration](#hardware-acceleration)
4. [Camera Setup](#camera-setup)
5. [Volume Structure](#volume-structure)
6. [Operations](#operations)

---

## Purpose

Frigate is a self-hosted NVR (Network Video Recorder) with real-time AI object detection. It processes RTSP camera streams using a hybrid GPU/CPU pipeline:

- **Intel UHD 630 GPU** — Hardware-accelerated H.264 decode/encode via VAAPI
- **OpenVINO on GPU** — AI inference for object detection (person, car, animal, etc.)
- **CPU** — Motion detection, automation logic

### Architecture

```
TP-Link Tapo C110 Cameras (RTSP)
  → Frigate Container
    ├── Video Decode (VAAPI - GPU)
    ├── Motion Detection (CPU)
    ├── Object Detection (OpenVINO - GPU)
    ├── Recording Storage → /home/storage/records/
    ├── Event Clips & Thumbnails
    └── Web UI → NPM → nvr.sahragty.me
```

---

## Container Configuration

```yaml
image: ghcr.io/blakeblackshear/frigate:stable
container_name: frigate
restart: always
stop_grace_period: 30s
shm_size: "1gb"

# Intel UHD 630 GPU access
devices:
  - /dev/dri:/dev/dri

# GPU monitoring capabilities
cap_add:
  - CAP_PERFMON
  - CAP_SYS_ADMIN

# CPU affinity — cores 0-5 (leave 6-7 for system)
cpuset: "0-5"

ports:
  - "127.0.0.1:5000:5000"

networks:
  - nginx-network

healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/api/stats"]
  interval: 600s              # 10-minute checks (reduced overhead)
  timeout: 5s
  retries: 2
  start_period: 120s          # 2-minute startup grace period

deploy:
  resources:
    limits:
      memory: 6G
      cpus: "6"
    reservations:
      memory: 3G
      cpus: "4"

logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "3"
```

| Resource | Limit | Actual Usage |
|----------|-------|-------------|
| Memory | 6 GB | ~709 MB (12%) |
| CPU | 6 cores (0-5) | Variable (video processing) |
| SHM | 1 GB | Video frame buffers |
| Log storage | 150 MB max | 3 × 50 MB rotation |

---

## Hardware Acceleration

| Component | Config | Purpose |
|-----------|--------|---------|
| GPU | Intel UHD 630 (`/dev/dri` mounted) | Video decode + AI inference |
| VAAPI driver | `iHD` (Intel iHD driver) | Hardware H.264 decode/encode |
| Object detection | OpenVINO on GPU | AI inference acceleration |

### Environment Variables

```env
# Intel GPU - VAAPI Hardware Acceleration
LIBVA_DRIVER_NAME=iHD
LIBVA_DRIVERS_PATH=/usr/lib/x86_64-linux-gnu/dri
INTEL_GPU_TOP=1

# OpenVINO - GPU-accelerated AI inference
OPENVINO_DEVICE=GPU
INTEL_OPENVINO_DIR=/opt/intel/openvino
GST_VAAPI_ALL_DRIVERS=1

# CPU Threading (reduced — GPU handles inference)
OMP_NUM_THREADS=4
MKL_NUM_THREADS=4
NUMBA_NUM_THREADS=4

# Hardware acceleration enabled
FRIGATE_DISABLE_HARDWARE_ACCELERATION=false

# Camera auth
FRIGATE_RTSP_PASSWORD=<REDACTED>

# Timezone
TZ=Africa/Cairo
```

---

## Camera Setup

| Camera | Model | Protocol | Resolution |
|--------|-------|----------|------------|
| Camera 1 | TP-Link Tapo C110 | RTSP | 1080p |
| Camera 2 | TP-Link Tapo C110 | RTSP | 1080p |

Camera streams are configured in `config.yaml` with RTSP URLs using the `FRIGATE_RTSP_PASSWORD` environment variable for authentication.

---

## Volume Structure

### Host Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|---------------|------|---------|
| `./volumes/frigate-config` | `/config` | rw | Configuration + database |
| `/home/storage/records` | `/media/frigate/recordings` | rw | Video recordings |
| tmpfs (1 GB) | `/tmp/cache` | rw | Temporary cache (RAM-based) |

### Config Volume Tree

```
/home/homeLab/volumes/frigate-config/           → /config/
├── config.yaml                                  # Main Frigate configuration
│                                                # (cameras, detectors, recordings, zones, etc.)
├── frigate.db                                   # SQLite event database
├── frigate.db-shm                               # SQLite shared memory
├── frigate.db-wal                               # SQLite write-ahead log
├── backup.db                                    # Database backup
├── model_cache/
│   └── openvino/
│       └── *.blob                               # Compiled OpenVINO model cache
├── .exports/                                    # Exported clips/snapshots
├── .timeline/                                   # Timeline data
└── .vacuum/                                     # Database vacuum state
```

### Recordings Volume

```
/home/storage/records/                          → /media/frigate/recordings/
├── 2025-09-25/                                  # Organized by date
├── 2026-01-13/
├── 2026-01-14/
├── ...
└── 2026-02-18/                                  # Current day
    └── HH/                                      # Organized by hour
        └── <camera>/<segment>.mp4               # 10-second segments
```

**Retention:** 30 days (automatically managed by the weekly maintenance script `server-maintenance.sh`).

### Tmpfs Cache

```yaml
tmpfs:
  - type: tmpfs
    target: /tmp/cache
    size: 1000000000        # 1 GB RAM cache
```

Used for temporary video processing artifacts. RAM-based to reduce SSD wear — cleared on container restart.

---

## Operations

### Restart

```bash
cd /home/homeLab
docker compose restart frigate
sleep 10
docker logs frigate --tail 50
```

### Health Check

```bash
# API health
curl -f http://localhost:5000/api/stats

# GPU utilization
intel_gpu_top -l 1
```

### View Logs

```bash
# Container logs
docker logs frigate --tail 100 -f

# NPM access log
docker exec nginx-manager tail -f /data/logs/nvr_access.log
```

### Storage Management

```bash
# Check recording disk usage
du -sh /home/storage/records/

# Check per-day usage
du -sh /home/storage/records/2026-02-*/

# Manual cleanup (recordings older than 30 days)
find /home/storage/records/ -type d -mtime +30 -exec rm -rf {} +
```

### Update

```bash
cd /home/homeLab
docker compose pull frigate
docker compose up -d --no-deps frigate
```
