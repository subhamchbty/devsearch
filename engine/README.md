# DevSearch — Engine

> Search API service powered by NestJS.

The engine handles query processing, hybrid search (BM25 + vector similarity), score normalization, and result ranking.

## Setup

```bash
pnpm install
```

## Running

```bash
# Development (watch mode) — http://localhost:3004
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## Testing

```bash
pnpm run test          # unit tests
pnpm run test:e2e      # end-to-end tests
pnpm run test:cov      # coverage report
```
