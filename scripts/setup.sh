#!/usr/bin/env bash
set -euo pipefail

echo "=== Natively AI - Development Setup ==="

command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install Node.js >= 20."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Install via: npm install -g pnpm"; exit 1; }

NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Node.js >= 20 required. Current: $(node -v)"
  exit 1
fi

echo "[1/5] Installing dependencies..."
pnpm install

echo "[2/5] Generating Prisma client..."
pnpm db:generate

echo "[3/5] Running database migrations..."
pnpm db:migrate

echo "[4/5] Seeding database..."
pnpm db:seed

echo "[5/5] Building shared packages..."
pnpm --filter @natively/shared build

echo ""
echo "=== Setup complete! ==="
echo "Run 'pnpm dev' to start development servers."
