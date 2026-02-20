# DevSearch — Indexer

> Indexing pipeline service powered by Express + TypeScript.

The indexer processes crawled content through a pipeline: clean HTML, chunk into 400–800 token segments, attach metadata (framework, version, URL, heading path, code blocks), and prepare data for embedding and storage.

## Setup

```bash
pnpm install
```

## Running

```bash
# Development (watch mode) — http://localhost:3002
pnpm dev

# Production
pnpm run build
pnpm start
```
