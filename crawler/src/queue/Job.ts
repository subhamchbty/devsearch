import { Job as BullJob, JobsOptions } from "bullmq";
import { QueueManager } from "./QueueManager";

/**
 * Base Job class — Laravel-style.
 *
 * Extend this class, set `queueName` and implement `handle()`.
 *
 * Usage:
 *   await CrawlPageJob.dispatch({ url: "https://..." });
 *   await CrawlPageJob.dispatch({ url: "..." }, { delay: 5000 });
 *   await CrawlPageJob.dispatchOn("high-priority", { url: "..." });
 */
export abstract class Job<TPayload = Record<string, unknown>> {
    // ── Subclass configuration ──────────────────────────────────────

    /** The queue this job should be dispatched to (override in subclass) */
    static queueName: string = "default";

    /**
     * Maximum number of attempts before the job is marked as failed.
     * Override in subclass to customise per-job.
     */
    static attempts: number | undefined;

    /**
     * Back-off strategy override.
     * Override in subclass to customise per-job.
     */
    static backoff:
        | { type: "exponential" | "fixed"; delay: number }
        | undefined;

    /**
     * Delay (ms) before the job becomes available for processing.
     * Override in subclass to customise per-job.
     */
    static delay: number | undefined;

    // ── Instance properties (available inside handle()) ─────────────

    /** The underlying BullMQ job instance, set by the worker before calling handle() */
    bullJob!: BullJob<TPayload>;

    /** Convenience accessor for job payload */
    get data(): TPayload {
        return this.bullJob.data;
    }

    // ── Abstract handler ────────────────────────────────────────────

    /**
     * Process the job — this is where your business logic goes.
     * Laravel equivalent: `public function handle()`
     */
    abstract handle(): Promise<void>;

    /**
     * Optional hook called when the job fails after all retries.
     * Laravel equivalent: `public function failed()`
     */
    async failed(_error: Error): Promise<void> {
        // Override in subclass if needed
    }

    // ── Static dispatchers ──────────────────────────────────────────

    /**
     * Dispatch this job onto its default queue.
     *
     * ```ts
     * await CrawlPageJob.dispatch({ url: "https://example.com" });
     * ```
     */
    static async dispatch(payload: any, opts?: JobsOptions) {
        const queueManager = QueueManager.getInstance();
        const queue = queueManager.getQueue(this.queueName);

        const mergedOpts: JobsOptions = {
            attempts: this.attempts,
            backoff: this.backoff,
            delay: this.delay,
            ...opts,
        };

        return queue.add(this.name, payload, mergedOpts);
    }

    /**
     * Dispatch this job onto a specific queue (overriding the default).
     *
     * ```ts
     * await CrawlPageJob.dispatchOn("high-priority", { url: "..." });
     * ```
     */
    static async dispatchOn(
        queueName: string,
        payload: any,
        opts?: JobsOptions,
    ) {
        const queueManager = QueueManager.getInstance();
        const queue = queueManager.getQueue(queueName);

        const mergedOpts: JobsOptions = {
            attempts: this.attempts,
            backoff: this.backoff,
            delay: this.delay,
            ...opts,
        };

        return queue.add(this.name, payload, mergedOpts);
    }
}
