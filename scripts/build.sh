#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Building Go backend..."
cd backend
go build -o ../bin/tokscale-server .
cd "$PROJECT_DIR"
echo "    Output: bin/tokscale-server"

echo "==> Building React frontend..."
cd frontend
npm install --silent
npm run build
cd "$PROJECT_DIR"
echo "    Output: frontend/dist/"

echo ""
echo "==> Build complete! To start the dashboard:"
echo "    bash scripts/start.sh"
