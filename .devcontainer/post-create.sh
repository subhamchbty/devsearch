#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Setting up DevSearch development environment..."

# Install dependencies for all services
services=("client" "crawler" "embedder" "engine" "indexer")

for service in "${services[@]}"; do
  if [ -d "$service" ] && [ -f "$service/package.json" ]; then
    echo "📦 Installing dependencies for $service..."
    (cd "$service" && pnpm install)
  fi
done

# Install NestJS CLI globally for backend services
pnpm add -g @nestjs/cli

echo ""
echo "✅ DevSearch development environment is ready!"
echo ""
echo "Available services:"
echo "  Client (Next.js):    cd client  && pnpm dev         → http://localhost:3000"
echo "  Crawler (Express):   cd crawler  && pnpm dev       → http://localhost:3001"
echo "  Indexer (Express):    cd indexer  && pnpm dev       → http://localhost:3002"
echo "  Embedder (Express):   cd embedder && pnpm dev       → http://localhost:3003"
echo "  Engine (NestJS):     cd engine && pnpm start:dev    → http://localhost:3004"
echo ""
echo "Infrastructure:"
echo "  PostgreSQL (pgvector): localhost:5432  (user: devsearch, pass: devsearch)"
echo "  Redis:                 localhost:6379"
echo ""
