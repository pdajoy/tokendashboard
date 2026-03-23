#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Collect data if not present
if [ ! -f "data/models.json" ]; then
  echo "==> Collecting initial data..."
  bash scripts/update-data.sh
fi

# Start Go backend in background
echo "==> Starting Go backend on :8787..."
cd backend
DATA_DIR="$PROJECT_DIR/data" \
FRONTEND_DIR="$PROJECT_DIR/frontend/dist" \
PORT=8787 \
  go run main.go &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Start frontend dev server
echo "==> Starting React dev server on :5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "  Dashboard (dev): http://localhost:5173"
echo "  API server:      http://localhost:8787"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

wait
