#!/usr/bin/env bash
# warm-image-cache.sh
# Pre-warms Next.js image optimization cache after deployment.
# Run after `docker compose up -d portfolio-app` to eliminate first-visitor
# 15-18s image loading delays caused by on-demand optimization.
#
# Usage:
#   ./scripts/warm-image-cache.sh [HOST]
#   HOST defaults to https://sahragty.me

set -euo pipefail

HOST="${1:-https://sahragty.me}"
PASS=0
FAIL=0

curl_image() {
    local path="$1"
    local width="$2"
    local encoded
    encoded="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${path}', safe=''))")"
    local url="${HOST}/_next/image?url=${encoded}&w=${width}&q=75"
    if curl -sSf -o /dev/null -w "  [%{http_code}] ${path} @${width}w\n" "$url"; then
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] ${url}" >&2
        FAIL=$((FAIL + 1))
    fi
}

echo "Warming image cache for ${HOST} ..."
echo ""

# ── Profile ──────────────────────────────────────────────────────────────────
echo "Profile:"
curl_image "/images/profile/Profile.jpg" 828
curl_image "/images/profile/Profile.jpg" 1080

# ── Project thumbnails ────────────────────────────────────────────────────────
echo ""
echo "Projects:"
project_dir="/home/homeLab/portfolio/public/images/projects"
if [[ -d "$project_dir" ]]; then
    while IFS= read -r -d '' file; do
        # Strip the public root to get the URL path
        url_path="${file#/home/homeLab/portfolio/public}"
        encoded="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${url_path}', safe='/'))")"
        if curl -sSf -o /dev/null -w "  [%{http_code}] ${url_path} @1200w\n" \
                "${HOST}/_next/image?url=${encoded}&w=1200&q=75"; then
            PASS=$((PASS + 1))
            # Also warm mobile width
            curl_image "${url_path}" 640
        else
            FAIL=$((FAIL + 1))
        fi
    done < <(find "$project_dir" -maxdepth 2 -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) -print0 | sort -z)
else
    echo "  (projects dir not found — skipping)"
fi

# ── Certificates ─────────────────────────────────────────────────────────────
echo ""
echo "Certificates:"
cert_dir="/home/homeLab/portfolio/public/images/certificates"
if [[ -d "$cert_dir" ]]; then
    while IFS= read -r -d '' file; do
        filename="$(basename "$file")"
        curl_image "/images/certificates/${filename}" 640
        curl_image "/images/certificates/${filename}" 1200
    done < <(find "$cert_dir" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) -print0)
else
    echo "  (certificate dir not found — skipping)"
fi

echo ""
echo "Done: ${PASS} warmed, ${FAIL} failed."
