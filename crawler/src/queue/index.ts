// ── Queue System (Laravel-style) ────────────────────────────────────
// Public API — import everything you need from "queue/"

export { Job } from "./Job";
export { getRegisteredJobNames, registerJobs, resolveJob } from "./JobRegistry";
export { default as queueConfig } from "./QueueConfig";
export { QueueManager } from "./QueueManager";
export { QueueWorker } from "./QueueWorker";

// ── Built-in jobs ───────────────────────────────────────────────────
export { CrawlPageJob } from "./jobs/CrawlPageJob";

// ── Convenience bootstrap ───────────────────────────────────────────
import { registerJobs } from "./JobRegistry";
import { QueueWorker } from "./QueueWorker";
import { CrawlPageJob } from "./jobs/CrawlPageJob";

/**
 * Boot the queue system — register all jobs and start workers.
 *
 * Call this once during app startup (after Redis is connected).
 *
 * ```ts
 * import { bootQueue } from "./queue";
 * await connectRedis();
 * bootQueue();
 * ```
 */
export function bootQueue(
    options: { queues?: string[]; concurrency?: number } = {},
): QueueWorker[] {
    const { queues = ["default"], concurrency = 1 } = options;

    // 1. Register all job handlers
    registerJobs(CrawlPageJob);

    // 2. Start a worker for each specified queue
    const workers: QueueWorker[] = queues.map((queueName) => {
        const worker = new QueueWorker(queueName, concurrency);
        worker.start();
        return worker;
    });

    console.log("[Queue] System booted ✓");
    return workers;
}
