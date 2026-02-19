# DevSearch

A high-performance semantic search engine for developer documentation.

DevSearch allows developers to search across official documentation of programming languages, frameworks, and tools, returning precise, ranked snippets instead of generic links.

---

# Vision

Developers waste time jumping between documentation sites, searching imprecise keywords, and scrolling through irrelevant results.

DevSearch aims to:

* Provide semantic + keyword hybrid search
* Preserve documentation structure
* Return exact relevant snippets
* Support version-aware filtering
* Optionally provide AI explanations (RAG layer)

This is not a chatbot. This is a precision documentation retrieval engine.

---

# Scope (Phase 1)

* 10 selected frameworks
* Static documentation ingestion
* Hybrid search (BM25 + vector similarity)
* Ranked snippet results
* No automatic LLM answers
* Clean, fast UI

---

# System Architecture

## High-Level Overview

Frontend (Next.js / React)
→ API Layer (Node.js)
→ Search Service
→ Vector Database
→ PostgreSQL (metadata, analytics)

Background Worker:
→ Crawler
→ Cleaner
→ Chunker
→ Embedding generator
→ Vector upsert

---

# Core Components

## 1. Crawler Service

Purpose:
Ingest official documentation.

Responsibilities:

* Crawl structured documentation sites
* Extract main content only
* Preserve heading hierarchy
* Extract code blocks separately
* Normalize URLs
* Deduplicate content

Note:
Crawling and embedding are separate processes.

---

## 2. Indexing Worker

Pipeline:

Raw Content
→ Clean HTML
→ Chunk (400–800 tokens)
→ Attach metadata
→ Generate embeddings
→ Store in vector DB
→ Store metadata in PostgreSQL

Metadata includes:

* Framework
* Version
* URL
* Heading path
* Code blocks
* Indexed timestamp

---

## 3. Storage Layer

### Vector Database

Stores:

* Embedding vectors
* Chunk text
* Metadata

Options:

* pgvector (initial MVP)
* Qdrant (scalable option)

### PostgreSQL

Stores:

* Framework list
* Versions
* Indexing jobs
* Analytics
* Feedback

Vector DB handles similarity. Postgres handles control logic.

---

## 4. Search Service

Query Pipeline:

User Query
→ Clean input
→ Generate query embedding
→ Vector similarity search (top K)
→ BM25 keyword search
→ Score normalization + merge
→ Re-ranking
→ Return top results

Target latency:
< 300ms (without LLM)

---

## 5. Optional LLM Layer (Phase 2)

When user clicks "Explain":

Top retrieved chunks
→ Build prompt
→ Send to LLM
→ Return explanation

LLM is not part of critical search path.

---

# Key Architecture Decisions

## 1. Hybrid Search from Day One

Pure embeddings are insufficient. Keyword matching is essential for developer queries.

## 2. Structure Preservation

Heading hierarchy and code separation significantly improve retrieval quality.

## 3. Separation of Concerns

* Crawler does not embed
* Search service does not crawl
* Worker handles indexing

## 4. Version-Aware Design

Documentation is version-sensitive. Version metadata is mandatory.

## 5. Feedback Loop

User interactions (clicks, upvotes) influence ranking adjustments.

---

# Non-Goals (Phase 1)

* Conversational chatbot
* Full web search
* Community Q&A
* Auto-crawling entire internet

---

# Performance Requirements

* Query latency < 300ms
* Deterministic ranking
* Incremental re-indexing support
* Safe rate-limited crawling

---

# Scaling Strategy

* Shard by framework
* Cache popular queries
* Use ANN index tuning (HNSW)
* Add re-ranking models

---

# Future Roadmap

## Phase 2

* LLM explanations (RAG)
* Version filtering UI
* Code highlighting
* Feedback system

## Phase 3

* Personalization
* CLI tool
* VSCode extension
* Query analytics dashboard
* Automated doc change detection

---

# Development Principles

* Optimize relevance over complexity
* Measure latency continuously
* Preserve semantic structure
* Ship small, iterate fast

---

# Technology Stack (Initial)

* Node.js (API + worker)
* Next.js (Frontend)
* PostgreSQL + pgvector
* Redis (optional caching)
* Dockerized deployment

---

# Final Statement

DevSearch is a retrieval system first. LLMs are optional augmentation.

Quality of indexing and ranking will determine success more than model selection.
