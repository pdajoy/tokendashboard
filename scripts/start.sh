#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT="${PORT:-8787}"

cd "$PROJECT_DIR"

# Build backend if needed
if [ ! -f "bin/tokscale-server" ]; then
  echo "==> Building Go backend..."
  cd backend
  go build -o ../bin/tokscale-server .
  cd "$PROJECT_DIR"
fi

# Build frontend if needed
if [ ! -d "frontend/dist" ]; then
  echo "==> Building React frontend..."
  cd frontend
  npm install
  npm run build
  cd "$PROJECT_DIR"
fi

# Collect data if not present
if [ ! -f "data/models.json" ]; then
  echo "==> Collecting initial data..."
  bash scripts/update-data.sh
fi

echo "==> Starting Tokscale Dashboard on http://localhost:$PORT"
DATA_DIR="$PROJECT_DIR/data" \
FRONTEND_DIR="$PROJECT_DIR/frontend/dist" \
PORT="$PORT" \
  "$PROJECT_DIR/bin/tokscale-server"
