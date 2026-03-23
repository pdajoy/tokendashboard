#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"

mkdir -p "$DATA_DIR"

echo "==> Collecting tokscale data..."

echo "  [1/3] Fetching models data..."
bunx tokscale@latest models --json 2>/dev/null > "$DATA_DIR/models.json"

echo "  [2/3] Fetching monthly data..."
bunx tokscale@latest monthly --json 2>/dev/null > "$DATA_DIR/monthly.json"

echo "  [3/3] Fetching graph/contributions data..."
bunx tokscale@latest graph --output "$DATA_DIR/graph.json" 2>/dev/null

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "{\"updatedAt\": \"$TIMESTAMP\"}" > "$DATA_DIR/meta.json"

echo "==> Data collection complete! Files saved to $DATA_DIR"
echo "    Updated at: $TIMESTAMP"
ls -lh "$DATA_DIR"/*.json
