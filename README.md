# DevSearch

> A high-performance semantic search engine for developer documentation.

DevSearch allows developers to search across official documentation of programming languages, frameworks, and tools, returning precise, ranked snippets instead of generic links.

**This is not a chatbot — it is a precision documentation retrieval engine.**

---

## Table of Contents

- [Vision](#vision)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Services](#running-the-services)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Roadmap](#roadmap)
- [Development Principles](#development-principles)

---

## Vision

Developers waste time jumping between documentation sites, searching imprecise keywords, and scrolling through irrelevant results.

DevSearch aims to:

- Provide **semantic + keyword hybrid search** across official documentation
- **Preserve documentation structure** (headings, code blocks, versions)
- Return **exact, relevant snippets** rather than page-level links
- Support **version-aware filtering**
- Optionally provide **AI-powered explanations** via a RAG layer (Phase 2)

---

## Features

### Phase 1 (Current)

- **Hybrid Search** — BM25 keyword matching combined with vector similarity for high-precision results
- **Documentation Crawling** — Structured ingestion of official documentation sites with heading hierarchy and code block preservation
- **Chunked Indexing** — Raw HTML → clean content → 400–800 token chunks with full metadata
- **Ranked Snippet Results** — Score normalization, merging, and re-ranking for optimal relevance
- **Version-Aware Metadata** — Framework version is a first-class attribute on every indexed chunk
- **Target Latency** — < 300 ms per query (without LLM)
- **10 selected frameworks** supported in Phase 1

### Phase 2 (Planned)

- LLM-based explanations (RAG layer, opt-in per query)
- Version filtering UI
- Code syntax highlighting
- User feedback and upvote system

### Phase 3 (Future)

- Personalization
- CLI tool
- VSCode extension
- Query analytics dashboard
- Automated documentation change detection

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Frontend (Next.js)            │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│         Engine — Search API (NestJS)    │
│                                         │
│  User Query → Clean → Embed → Search   │
│  BM25 + Vector → Normalize → Re-rank   │
└────────┬──────────────────┬─────────────┘
         │                  │
┌────────▼────────┐  ┌──────▼──────────┐
│   pgvector /    │  │   PostgreSQL    │
│   Qdrant        │  │  (metadata,     │
│  (embeddings)   │  │   analytics)    │
└─────────────────┘  └─────────────────┘

Background Pipeline:
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Crawler  │ → │ Indexer  │ → │ Embedder │ → │  Store   │
│(NestJS)  │   │(NestJS)  │   │(NestJS)  │   │ (DB/Vec) │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### Core Services

| Service | Responsibility |
|---------|---------------|
| **engine** | Search API — query processing, hybrid search, result ranking |
| **crawler** | Documentation ingestion — crawl, extract, deduplicate |
| **indexer** | Indexing pipeline — clean, chunk, attach metadata |
| **embedder** | Embedding generation for chunks and queries |
| **client** | Next.js frontend — search UI |

### Key Architecture Decisions

1. **Hybrid search from day one** — pure embeddings are insufficient for developer queries; keyword matching is essential.
2. **Structure preservation** — heading hierarchy and separate code block extraction significantly improve retrieval quality.
3. **Separation of concerns** — the crawler does not embed, the search service does not crawl, and the indexer handles the pipeline independently.
4. **Version-aware design** — documentation is version-sensitive; version metadata is mandatory on every chunk.
5. **Feedback loop** — user interactions (clicks, upvotes) inform ranking adjustments.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript 5 |
| Backend Services | NestJS 11, TypeScript 5.7 |
| Primary Database | PostgreSQL 14+ |
| Vector Storage | pgvector (MVP) → Qdrant (scale) |
| Caching | Redis (optional) |
| Package Manager | pnpm (workspaces / monorepo) |
| Testing | Jest 30 |
| Linting / Formatting | ESLint 9, Prettier 3 |

---

## Project Structure

```
devsearch/
├── client/          # Next.js frontend (search UI)
├── engine/          # Search API service (NestJS)
├── crawler/         # Documentation crawler service (NestJS)
├── indexer/         # Indexing pipeline worker (NestJS)
├── embedder/        # Embedding generation service (NestJS)
├── pnpm-workspace.yaml
└── project-requirements.md
```

Each service follows the NestJS module structure:

```
<service>/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── app.service.ts
├── test/
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** 18 LTS or later
- **pnpm** 8.0 or later — `npm install -g pnpm`
- **PostgreSQL** 14+ with the [pgvector](https://github.com/pgvector/pgvector) extension
- **Docker** (optional, for containerised deployment)

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/subhamchbty/devsearch.git
cd devsearch

# 2. Install all workspace dependencies
pnpm install
```

---

## Running the Services

### Development

Open a separate terminal for each service:

```bash
# Frontend — http://localhost:3000
cd client && pnpm run dev

# Search API
cd engine && pnpm run start:dev

# Crawler
cd crawler && pnpm run start:dev

# Indexer
cd indexer && pnpm run start:dev

# Embedder
cd embedder && pnpm run start:dev
```

### Production

```bash
# Build all services
pnpm --recursive run build

# Start each service
cd engine   && pnpm run start:prod
cd crawler  && pnpm run start:prod
cd indexer  && pnpm run start:prod
cd embedder && pnpm run start:prod
cd client   && pnpm run start
```

---

## Testing

Run these commands from within the relevant service directory:

```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:cov

# End-to-end tests
pnpm run test:e2e
```

### Linting & Formatting

```bash
# Lint TypeScript files
pnpm run lint

# Format with Prettier
pnpm run format
```

---

## Environment Variables

Create a `.env` file in the root of each service (or in the monorepo root) as needed.

### Engine / General

```env
PORT=3000
NODE_ENV=development
```

### Database

```env
DATABASE_URL=postgresql://user:password@localhost:5432/devsearch
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=devsearch_user
DATABASE_PASSWORD=your_password
DATABASE_NAME=devsearch
```

### Vector Database (Qdrant, Phase 2+)

```env
VECTOR_DB_URL=http://localhost:6333
VECTOR_DB_API_KEY=your_api_key
```

### Embeddings (Phase 2+)

```env
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=your_api_key
```

### LLM Integration (Phase 2+)

```env
LLM_PROVIDER=openai
LLM_API_KEY=your_api_key
LLM_MODEL=gpt-4-turbo
```

### Caching (optional)

```env
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
CACHE_TTL=3600
```

### Crawler

```env
CRAWLER_RATE_LIMIT=10
CRAWLER_TIMEOUT=30000
CRAWLER_USER_AGENT=DevSearchBot/1.0
```

---

## Roadmap

| Phase | Status | Highlights |
|-------|--------|-----------|
| Phase 1 | 🚧 In Progress | Hybrid search, 10 frameworks, snippet results, clean UI |
| Phase 2 | 📋 Planned | LLM explanations (RAG), version filtering UI, feedback system |
| Phase 3 | 🔭 Future | CLI tool, VSCode extension, personalization, analytics dashboard |

---

## Development Principles

- **Optimize relevance over complexity** — a better index beats a bigger model.
- **Measure latency continuously** — the 300 ms target is non-negotiable.
- **Preserve semantic structure** — headings and code blocks are first-class data.
- **Ship small, iterate fast** — working retrieval ships before optional LLM features.

---

## Non-Goals (Phase 1)

- Conversational chatbot
- Full web / internet search
- Community Q&A platform
- Auto-crawling the entire internet
