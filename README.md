# DevSearch

A self-hostable semantic search engine for your team's internal documentation. Connect your GitHub repos and markdown files. Get semantic search across all of them in minutes.

---

## Overview

DevSearch indexes your internal documentation — markdown files, ADRs, RFCs, GitHub repos — and makes them semantically searchable. Instead of keyword matching, DevSearch understands meaning, so searching for "why did we choose postgres" finds the ADR that explains your database decision even if it never uses those exact words.

Built as an open-source, self-hostable alternative to expensive enterprise knowledge search tools.

---

## Architecture

```
Next.js Frontend
      ↓ HTTP
NestJS Application
  ├── ConnectorModule     — fetches documents from sources (filesystem, GitHub)
  ├── NormalizerModule    — outputs standard Document schema
  ├── ChunkerModule       — splits large docs into indexable chunks
  ├── EmbedderModule      — generates vectors via BullMQ workers
  └── SearchModule        — semantic search HTTP API
      ↓
Postgres + pgvector       — vector storage and search
Redis                     — BullMQ job queues between pipeline stages
```

**Pipeline flow:**
```
Connector → Normalizer → Chunker → Embedder → pgvector index → Search API
```

Each pipeline stage communicates asynchronously via BullMQ queues backed by Redis. This gives the pipeline retry handling, job state tracking, and failure isolation without the overhead of separate services.

---

## Features

- **Semantic search** — pgvector-powered similarity search, not just keyword matching
- **Filesystem connector** — index local markdown files, ADRs, RFCs from any directory
- **GitHub connector** — index markdown files, READMEs, and docs from any GitHub repo
- **Async pipeline** — BullMQ-driven connector → chunk → embed pipeline with retries
- **Self-hostable** — runs entirely on your infrastructure, your data never leaves
- **Observable** — OpenTelemetry instrumentation across the full pipeline

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/subhamchbty/devsearch
cd devsearch

# Start all services
docker-compose up

# DevSearch is now running at http://localhost:3000
```

Requires Docker and Docker Compose. No other dependencies.

---

## Project Structure

```
devsearch/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # NestJS application
│       ├── src/
│       │   ├── connector/    # Filesystem and GitHub connectors
│       │   ├── normalizer/   # Document schema normalization
│       │   ├── chunker/      # Document chunking
│       │   ├── embedder/     # Vector embedding via BullMQ workers
│       │   └── search/       # Search API
├── infra/                    # Terraform IaC for EKS deployment
│   ├── modules/
│   │   ├── vpc/
│   │   ├── eks/
│   │   ├── rds/
│   │   ├── elasticache/
│   │   └── s3/
│   └── environments/
│       ├── dev/
│       └── prod/
├── helm/                     # Helm chart for Kubernetes deployment
│   └── devsearch/
├── k8s/                      # Raw Kubernetes manifests
├── docs/
│   ├── getting-started.md
│   ├── connectors/
│   │   ├── filesystem.md
│   │   └── github.md
│   ├── configuration.md
│   └── adr/                  # Architectural Decision Records
├── docker-compose.yml
└── README.md
```

---

## Roadmap

- [ ] Filesystem connector
- [ ] GitHub connector
- [ ] Confluence connector
- [ ] Notion connector
- [ ] Slack connector
- [ ] Re-indexing from S3 raw store without re-fetching
- [ ] Multi-tenant support
- [ ] Web UI for connector management

---

## License

MIT