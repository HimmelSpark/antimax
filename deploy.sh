#!/bin/bash
set -e

# ─── Configuration ───────────────────────────────────────────
DOMAIN="${DOMAIN:-v3075401.hosted-by-vdsina.ru}"

echo "==> Deploying Antimax to ${DOMAIN}"

# ─── Generate secrets if .env doesn't exist ──────────────────
if [ ! -f .env ]; then
  echo "==> Generating .env..."

  JWT_SECRET=$(openssl rand -hex 32)
  LIVEKIT_API_KEY="antimax_api"
  LIVEKIT_API_SECRET=$(openssl rand -hex 32)
  MINIO_ACCESS_KEY="antimax_minio"
  MINIO_SECRET_KEY=$(openssl rand -hex 24)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)

  cat > .env <<EOF
# Domain
DOMAIN=${DOMAIN}

# Server
SERVER_PORT=8080
JWT_SECRET=${JWT_SECRET}

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=antimax
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=antimax
DATABASE_URL=postgres://antimax:${POSTGRES_PASSWORD}@postgres:5432/antimax?sslmode=disable

# Redis
REDIS_URL=redis://redis:6379

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=antimax
MINIO_USE_SSL=false

# LiveKit
LIVEKIT_HOST=http://livekit:7880
LIVEKIT_PUBLIC_URL=wss://${DOMAIN}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}

# Gotenberg
GOTENBERG_URL=http://gotenberg:3000

# CORS
CORS_ORIGIN=https://${DOMAIN}
EOF

  echo "==> .env generated with random secrets"
else
  echo "==> .env already exists, skipping generation"
fi

# ─── Read keys from .env ─────────────────────────────────────
set -a
source .env
set +a

# ─── Detect public IP ────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 ipinfo.io/ip || hostname -I | awk '{print $1}')
echo "==> Detected public IP: ${PUBLIC_IP}"

# ─── Generate livekit.yaml ───────────────────────────────────
echo "==> Generating livekit.yaml..."

cat > livekit.yaml <<EOF
port: 7880
bind_addresses:
  - 0.0.0.0
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
rtc:
  tcp_port: 7881
  port_range_start: 7882
  port_range_end: 7932
  use_external_ip: true
  node_ip: ${PUBLIC_IP}
EOF

echo "==> livekit.yaml generated"

# ─── Open firewall ports ─────────────────────────────────────
if command -v ufw &> /dev/null; then
  echo "==> Configuring firewall..."
  ufw allow 80/tcp   2>/dev/null || true
  ufw allow 443/tcp  2>/dev/null || true
  ufw allow 7881/tcp 2>/dev/null || true
  ufw allow 7882:7932/udp 2>/dev/null || true
fi

# ─── Build & start ───────────────────────────────────────────
echo "==> Building containers..."
docker-compose -f docker-compose.prod.yml build

echo "==> Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "==> Waiting for services to start..."
sleep 8

docker-compose -f docker-compose.prod.yml ps

echo ""
echo "============================================"
echo "  Antimax is running!"
echo "  URL: https://${DOMAIN}"
echo ""
echo "  Caddy will auto-provision SSL certificate."
echo "  First request may take ~30s for cert."
echo "============================================"
