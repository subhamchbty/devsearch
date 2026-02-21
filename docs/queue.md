# Queue System

A Laravel-inspired job queue system built on top of [BullMQ](https://docs.bullmq.io/) and [IORedis](https://github.com/redis/ioredis). It lets you dispatch jobs onto Redis-backed queues and process them asynchronously with dedicated workers — exactly like Laravel's `dispatch()` / `php artisan queue:work` workflow.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Booting the Queue System](#booting-the-queue-system)
- [Creating a Job](#creating-a-job)
    - [Job Class Structure](#job-class-structure)
    - [Configuration Options](#configuration-options)
    - [The `handle()` Method](#the-handle-method)
    - [The `failed()` Hook](#the-failed-hook)
- [Dispatching Jobs](#dispatching-jobs)
    - [Basic Dispatch](#basic-dispatch)
    - [Delayed Dispatch](#delayed-dispatch)
    - [Dispatch to a Specific Queue](#dispatch-to-a-specific-queue)
    - [Advanced BullMQ Options](#advanced-bullmq-options)
- [Registering Jobs](#registering-jobs)
- [Workers](#workers)
    - [How Workers Resolve Jobs](#how-workers-resolve-jobs)
    - [Starting Workers Manually](#starting-workers-manually)
    - [Concurrency](#concurrency)
    - [Stopping Workers](#stopping-workers)
- [Queue Configuration](#queue-configuration)
- [File Reference](#file-reference)
- [Full Example: Adding a New Job End-to-End](#full-example-adding-a-new-job-end-to-end)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Your App Code                      │
│                                                         │
│   await MyJob.dispatch({ ... })                         │
│         │                                               │
│         ▼                                               │
│   ┌───────────┐    BullMQ     ┌─────────┐              │
│   │   Job.ts   │ ──────────▶  │  Redis   │              │
│   │ (dispatch) │   enqueue    │  Queue   │              │
│   └───────────┘              └────┬─────┘              │
│                                   │                     │
│                              dequeue                    │
│                                   │                     │
│                                   ▼                     │
│                          ┌──────────────┐               │
│                          │ QueueWorker  │               │
│                          │  (consume)   │               │
│                          └──────┬───────┘               │
│                                 │                       │
│                          resolve via                    │
│                          JobRegistry                    │
│                                 │                       │
│                                 ▼                       │
│                          ┌──────────────┐               │
│                          │  MyJob       │               │
│                          │  .handle()   │               │
│                          └──────────────┘               │
└─────────────────────────────────────────────────────────┘
```

| Component          | Laravel Equivalent              | Description                                                 |
| ------------------ | ------------------------------- | ----------------------------------------------------------- |
| `Job` (base class) | `ShouldQueue` + job class       | Abstract class — extend it and implement `handle()`         |
| `JobRegistry`      | IoC container                   | Maps job class names → constructors for worker resolution   |
| `QueueManager`     | `Illuminate\Queue\QueueManager` | Singleton managing BullMQ `Queue` instances per queue name  |
| `QueueWorker`      | `php artisan queue:work`        | Consumes jobs from a queue and invokes the matching handler |
| `QueueConfig`      | `config/queue.php`              | Central configuration (defaults, Redis connection, prefix)  |
| `bootQueue()`      | `AppServiceProvider::boot()`    | Convenience function to register jobs and start workers     |

---

## Getting Started

### Prerequisites

The queue system requires a running Redis instance. Connection settings are read from environment variables (or fall back to defaults):

| Variable         | Default     | Description               |
| ---------------- | ----------- | ------------------------- |
| `REDIS_HOST`     | `localhost` | Redis server hostname     |
| `REDIS_PORT`     | `6379`      | Redis server port         |
| `REDIS_PASSWORD` | _(none)_    | Redis password (optional) |

The required npm packages (`bullmq`, `ioredis`) are already included in the crawler's `package.json`.

### Booting the Queue System

The queue system is booted automatically during app startup in `src/index.ts`:

```ts
import { bootQueue } from "./queue";

// After Redis is connected...
bootQueue({ queues: ["default"], concurrency: 2 });
```

`bootQueue()` does two things:

1. **Registers** all known job classes with the `JobRegistry`
2. **Starts a worker** for each queue name provided

| Option        | Type       | Default       | Description                                      |
| ------------- | ---------- | ------------- | ------------------------------------------------ |
| `queues`      | `string[]` | `["default"]` | Queue names to listen on                         |
| `concurrency` | `number`   | `1`           | Number of jobs each worker processes in parallel |

---

## Creating a Job

### Job Class Structure

Create a new file under `src/queue/jobs/` and extend the base `Job` class:

```ts
// src/queue/jobs/SendEmailJob.ts
import { Job } from "../Job";

interface SendEmailPayload {
    to: string;
    subject: string;
    body: string;
}

export class SendEmailJob extends Job<SendEmailPayload> {
    // ── Configuration ─────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 1000 };

    // ── Handler ───────────────────────────────────────
    async handle(): Promise<void> {
        const { to, subject, body } = this.data;
        console.log(`Sending email to ${to}: ${subject}`);
        // ... send the email
    }

    // ── Failed hook (optional) ────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(`Email to ${this.data.to} failed: ${error.message}`);
    }
}
```

### Configuration Options

Override these static properties on your job class to customise its behaviour:

| Property    | Type                                                | Default            | Description                                         |
| ----------- | --------------------------------------------------- | ------------------ | --------------------------------------------------- |
| `queueName` | `string`                                            | `"default"`        | Which queue the job is dispatched to                |
| `attempts`  | `number \| undefined`                               | Config default (3) | Max retry attempts before marking as failed         |
| `backoff`   | `{ type: "exponential" \| "fixed", delay: number }` | Config default     | Back-off strategy between retries                   |
| `delay`     | `number \| undefined`                               | `undefined`        | Default delay (ms) before the job becomes available |

### The `handle()` Method

This is where your business logic lives. It's called by the worker when the job is dequeued.

- Access the payload via `this.data` (typed to `TPayload`)
- Access the underlying BullMQ job via `this.bullJob` (for progress reporting, logging, etc.)
- **Throw an error** to signal failure — BullMQ will retry according to the `attempts` / `backoff` config

```ts
async handle(): Promise<void> {
    const { url } = this.data;

    const response = await fetch(url);
    if (!response.ok) {
        // Throwing triggers a retry
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    // ... process html
}
```

### The `failed()` Hook

Called **after all retries are exhausted** and the job has permanently failed. Use it for cleanup, notifications, or logging:

```ts
async failed(error: Error): Promise<void> {
    console.error(`Job permanently failed: ${error.message}`);
    // Send alert, write to dead-letter table, etc.
}
```

---

## Dispatching Jobs

### Basic Dispatch

```ts
import { CrawlPageJob } from "./queue";

await CrawlPageJob.dispatch({ url: "https://laravel.com/docs/12.x" });
```

The job is serialised and added to the Redis queue. A running worker will pick it up and call `handle()`.

### Delayed Dispatch

Delay a job by a specified number of milliseconds:

```ts
// Process after 30 seconds
await CrawlPageJob.dispatch({ url: "https://example.com" }, { delay: 30_000 });
```

You can also set a default delay on the job class:

```ts
export class SlowJob extends Job<MyPayload> {
    static override delay = 60_000; // 1 minute default delay
    // ...
}
```

### Dispatch to a Specific Queue

Override the job's default queue at dispatch time using `dispatchOn()`:

```ts
await CrawlPageJob.dispatchOn("high-priority", {
    url: "https://important.com",
});
```

> **Note:** Make sure a worker is listening on `"high-priority"` — either via `bootQueue({ queues: ["default", "high-priority"] })` or by starting one manually.

### Advanced BullMQ Options

The second argument to `dispatch()` (or third to `dispatchOn()`) accepts any [BullMQ `JobsOptions`](https://api.docs.bullmq.io/interfaces/v5.JobsOptions.html):

```ts
await CrawlPageJob.dispatch(
    { url: "https://example.com" },
    {
        delay: 5000,
        attempts: 5,
        backoff: { type: "fixed", delay: 3000 },
        priority: 1, // lower = higher priority
        removeOnComplete: true,
        jobId: "unique-id", // deduplicate by custom ID
    },
);
```

---

## Registering Jobs

Every job class **must be registered** before a worker can process it. The registry maps the class name (e.g. `"CrawlPageJob"`) to its constructor so the worker can instantiate the right handler.

Registration happens inside `bootQueue()` in `src/queue/index.ts`:

```ts
import { registerJobs } from "./JobRegistry";
import { CrawlPageJob } from "./jobs/CrawlPageJob";
import { SendEmailJob } from "./jobs/SendEmailJob";

// Inside bootQueue():
registerJobs(CrawlPageJob, SendEmailJob);
```

You can also register jobs manually anywhere before the worker starts:

```ts
import { registerJobs } from "./queue";
registerJobs(MyCustomJob);
```

**If you forget to register a job**, the worker will throw:

```
[QueueWorker] No handler registered for job "MyCustomJob". Did you forget to call registerJobs()?
```

---

## Workers

### How Workers Resolve Jobs

1. A `QueueWorker` pulls a job off the BullMQ queue
2. It reads the job's `name` property (which equals the class name, set by `dispatch()`)
3. It looks up the constructor in the `JobRegistry`
4. It creates a new instance, injects the BullMQ job reference, and calls `handle()`

### Starting Workers Manually

If you need more control than `bootQueue()` provides:

```ts
import { QueueWorker, registerJobs } from "./queue";
import { CrawlPageJob } from "./queue/jobs/CrawlPageJob";

// Register handlers first
registerJobs(CrawlPageJob);

// Start worker
const worker = new QueueWorker("default", 3); // queue name, concurrency
worker.start();
```

### Concurrency

Concurrency controls how many jobs a single worker processes simultaneously:

```ts
// Process up to 5 jobs at once
const worker = new QueueWorker("default", 5);
worker.start();
```

Or via `bootQueue()`:

```ts
bootQueue({ queues: ["default"], concurrency: 5 });
```

### Stopping Workers

Gracefully shut down a worker (finishes current jobs, then stops):

```ts
await worker.stop();
```

To close all queue connections:

```ts
import { QueueManager } from "./queue";
await QueueManager.getInstance().closeAll();
```

---

## Queue Configuration

Central defaults are defined in `src/queue/QueueConfig.ts`:

```ts
const queueConfig: QueueConfigOptions = {
    defaultQueue: "default", // Fallback queue name
    connection: redisConnection, // IORedis instance
    defaultAttempts: 3, // Retry count
    defaultBackoff: {
        type: "exponential", // "exponential" | "fixed"
        delay: 1000, // Base delay in ms
    },
    prefix: "devsearch", // Redis key prefix
};
```

These defaults apply to **all queues** and can be overridden per-job (via static properties) or per-dispatch (via `JobsOptions`).

**Override priority** (highest wins):

1. Options passed to `dispatch()` / `dispatchOn()`
2. Static properties on the job class (`attempts`, `backoff`, `delay`)
3. `QueueConfig` defaults

---

## File Reference

```
crawler/src/queue/
├── index.ts          # Public API exports + bootQueue()
├── Job.ts            # Base abstract Job class
├── JobRegistry.ts    # Maps job names → constructors
├── QueueConfig.ts    # Central configuration
├── QueueManager.ts   # Singleton managing BullMQ Queue instances
├── QueueWorker.ts    # Consumes jobs and calls handle()
└── jobs/
    ├── index.ts          # Re-exports all job classes
    └── CrawlPageJob.ts   # Example: crawls a URL
```

---

## Full Example: Adding a New Job End-to-End

**Step 1 — Create the job class**

```ts
// src/queue/jobs/IndexDocumentJob.ts
import { Job } from "../Job";

interface IndexDocumentPayload {
    documentId: number;
    content: string;
}

export class IndexDocumentJob extends Job<IndexDocumentPayload> {
    static override queueName = "default";
    static override attempts = 2;

    async handle(): Promise<void> {
        const { documentId, content } = this.data;
        console.log(
            `Indexing document #${documentId} (${content.length} chars)`,
        );
        // ... index into search engine
    }

    async failed(error: Error): Promise<void> {
        console.error(
            `Indexing document #${this.data.documentId} failed: ${error.message}`,
        );
    }
}
```

**Step 2 — Export it from the jobs barrel**

```ts
// src/queue/jobs/index.ts
export { CrawlPageJob } from "./CrawlPageJob";
export { IndexDocumentJob } from "./IndexDocumentJob";
```

**Step 3 — Register it in `bootQueue()`**

```ts
// src/queue/index.ts  (inside bootQueue)
import { IndexDocumentJob } from "./jobs/IndexDocumentJob";

registerJobs(CrawlPageJob, IndexDocumentJob);
```

**Step 4 — Dispatch it from anywhere**

```ts
import { IndexDocumentJob } from "./queue";

await IndexDocumentJob.dispatch({
    documentId: 42,
    content: "<html>...</html>",
});
```

That's it. The worker will pick up the job, resolve `IndexDocumentJob` from the registry, and call `handle()`.
