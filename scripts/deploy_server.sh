#!/bin/bash
# =============================================================================
# csbot_admin_system — Deployment Script
# Usage: ./deploy_server.sh [--skip-build] [--skip-health]
# =============================================================================

set -euo pipefail

# === Configuration ===
APP_NAME="csbot_admin_system"
DEPLOY_BASE="/opt/${APP_NAME}"
DEPLOY_DIR="${DEPLOY_BASE}/app"
DEPLOY_USER="csbot"
DEPLOY_GROUP="${DEPLOY_USER}"
LOG_DIR="${DEPLOY_BASE}/logs"
ENV_SOURCE="${DEPLOY_BASE}/.env"
SERVICE_NAME="${APP_NAME}"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

# Health check
HEALTH_URL="http://127.0.0.1:${PORT:-3000}/api/trpc/publicApi.health"
HEALTH_TIMEOUT=15
HEALTH_RETRIES=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERR]${NC} $1"; }

# === Parse flags ===
SKIP_BUILD=false
SKIP_HEALTH=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-health) SKIP_HEALTH=true; shift ;;
    --help)
      echo "Usage: $0 [--skip-build] [--skip-health]"
      echo "  --skip-build  Skip pnpm build step (use existing dist/)"
      echo "  --skip-health Skip health check after deploy"
      exit 0
      ;;
    *) log_error "Unknown flag: $1"; exit 1 ;;
  esac
done

# === Pre-flight checks ===
if ! command -v pnpm &>/dev/null; then
  log_error "pnpm not found. Install with: npm install -g pnpm"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log_info "Deployment starting: ${APP_NAME}"
log_info "Project root: ${PROJECT_ROOT}"
log_info "Deploy target: ${DEPLOY_DIR}"

# === Step 1: Build ===
if [[ "${SKIP_BUILD}" == "false" ]]; then
  log_info "Building TypeScript (pnpm build)..."
  cd "${PROJECT_ROOT}"

  pnpm install --frozen-lockfile || pnpm install
  pnpm build

  if [[ ! -d "${PROJECT_ROOT}/dist" ]]; then
    log_error "Build failed: dist/ directory not found"
    exit 1
  fi

  log_info "Build completed successfully"
else
  log_warn "Skipping build (using existing dist/)"
fi

# === Step 2: Create deploy directory structure ===
log_info "Preparing deploy directory..."

if id "${DEPLOY_USER}" &>/dev/null; then
  log_info "User ${DEPLOY_USER} exists"
else
  log_info "Creating user ${DEPLOY_USER}..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "${DEPLOY_USER}" || true
fi

mkdir -p "${DEPLOY_DIR}"
mkdir -p "${LOG_DIR}"
mkdir -p "${DEPLOY_BASE}/backup"

# === Step 3: Stop existing service ===
log_info "Stopping existing service (if running)..."
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
  systemctl stop "${SERVICE_NAME}" || true
  log_info "Service stopped"
else
  log_info "Service not running — skipping stop"
fi

# === Step 4: Backup current release ===
if [[ -d "${DEPLOY_DIR}/server" ]] || [[ -f "${DEPLOY_DIR}/index.js" ]]; then
  BACKUP_DIR="${DEPLOY_BASE}/backup/$(date +%Y%m%d_%H%M%S)"
  mkdir -p "${BACKUP_DIR}"
  log_info "Backing up current release to ${BACKUP_DIR}..."
  rsync -a --delete "${DEPLOY_DIR}/" "${BACKUP_DIR}/" 2>/dev/null || cp -r "${DEPLOY_DIR}" "${BACKUP_DIR}/"
fi

# === Step 5: Sync build artifacts ===
log_info "Syncing build artifacts to ${DEPLOY_DIR}..."
rsync -a \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='*.ts' \
  --exclude='__pycache__/' \
  "${PROJECT_ROOT}/dist/" "${DEPLOY_DIR}/"

# Sync package.json and pnpm-lock.yaml for runtime dependency install
cp "${PROJECT_ROOT}/package.json" "${DEPLOY_DIR}/package.json"
cp "${PROJECT_ROOT}/pnpm-lock.yaml" "${DEPLOY_DIR}/pnpm-lock.yaml" 2>/dev/null || true

# === Step 6: Copy environment variables ===
log_info "Copying environment variables..."
if [[ -f "${ENV_SOURCE}" ]]; then
  cp "${ENV_SOURCE}" "${DEPLOY_DIR}/.env"
  log_info "Environment file copied from ${ENV_SOURCE}"
else
  if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    cp "${PROJECT_ROOT}/.env" "${DEPLOY_DIR}/.env"
    log_warn "No deploy .env found — copied from project root"
  else
    log_warn "No .env file found. Copy ${ENV_SOURCE}.example to ${ENV_SOURCE}"
  fi
fi

# === Step 7: Install production dependencies ===
log_info "Installing production dependencies..."
cd "${DEPLOY_DIR}"
pnpm install --prod --frozen-lockfile || pnpm install --prod

# === Step 8: Set permissions ===
log_info "Setting ownership..."
chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "${DEPLOY_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "${LOG_DIR}"

# === Step 9: Install/update systemd unit ===
log_info "Installing systemd service..."
cat > "${SYSTEMD_UNIT}" << 'SYSTEMD_EOF'
[Unit]
Description=CSBot Admin System — tRPC + Express operator dashboard
After=network.target

[Service]
Type=simple
User=csbot
Group=csbot
WorkingDirectory=/opt/csbot_admin_system/app
Environment=NODE_ENV=production
EnvironmentFile=/opt/csbot_admin_system/app/.env
ExecStart=/usr/local/bin/node /opt/csbot_admin_system/app/server/_core/index.js
Restart=always
RestartSec=10
StandardOutput=append:/opt/csbot_admin_system/logs/stdout.log
StandardError=append:/opt/csbot_admin_system/logs/stderr.log

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/csbot_admin_system/logs

# Resource limits
MemoryMax=1G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
log_info "Systemd unit installed"

# === Step 10: Start service ===
log_info "Starting service..."
systemctl enable "${SERVICE_NAME}" 2>/dev/null || true
systemctl start "${SERVICE_NAME}"

# === Step 11: Health check ===
if [[ "${SKIP_HEALTH}" == "false" ]]; then
  log_info "Waiting for service to become healthy..."
  sleep 3

  RETRY=0
  HEALTH_OK=false
  while (( RETRY < HEALTH_RETRIES )); do
    PORT_DEPLOYED=$(grep -E '^PORT=' "${DEPLOY_DIR}/.env" 2>/dev/null | cut -d'=' -f2 || echo "3000")
    HEALTH_URL_CHECK="http://127.0.0.1:${PORT_DEPLOYED}/api/trpc/publicApi.health"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${HEALTH_TIMEOUT}" "${HEALTH_URL_CHECK}" 2>/dev/null || echo "000")

    if [[ "${HTTP_CODE}" == "200" ]]; then
      log_info "Health check passed (HTTP ${HTTP_CODE})"
      HEALTH_OK=true
      break
    fi

    RETRY=$((RETRY + 1))
    log_warn "Health check attempt ${RETRY}/${HEALTH_RETRIES} failed (HTTP ${HTTP_CODE})"
    sleep 4
  done

  if [[ "${HEALTH_OK}" == "false" ]]; then
    log_error "Health check failed after ${HEALTH_RETRIES} attempts"
    log_info "Checking logs..."
    journalctl -u "${SERVICE_NAME}" --no-pager -n 30 2>/dev/null || \
      tail -n 30 "${LOG_DIR}/stderr.log" 2>/dev/null || true
    log_warn "Deployment completed but health check failed — manual inspection required"
    exit 0
  fi
else
  log_warn "Skipping health check (--skip-health)"
fi

# === Step 12: Post-deploy summary ===
log_info "========================================"
log_info "Deployment completed successfully"
log_info "  Service: ${SERVICE_NAME}"
log_info "  Deployed to: ${DEPLOY_DIR}"
log_info "  Logs: ${LOG_DIR}"
log_info "  Systemd: ${SYSTEMD_UNIT}"
log_info "========================================"
log_info "Manage with:"
log_info "  systemctl status ${SERVICE_NAME}"
log_info "  journalctl -u ${SERVICE_NAME} -f"
log_info "  systemctl restart ${SERVICE_NAME}"