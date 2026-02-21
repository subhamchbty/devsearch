import { Job as BullJob, Worker, WorkerOptions } from "bullmq";
import { resolveJob } from "./JobRegistry";
import queueConfig from "./QueueConfig";

/**
 * QueueWorker — consumes jobs from a BullMQ queue and delegates
 * to the matching registered Job class's `handle()` method.
 *
 * Laravel equivalent: `php artisan queue:work`
 *
 * Usage:
 *   const worker = new QueueWorker("default");
 *   worker.start();
 */
export class QueueWorker {
    private worker: Worker | null = null;
    private readonly queueName: string;
    private readonly concurrency: number;

    constructor(queueName?: string, concurrency: number = 1) {
        this.queueName = queueName || queueConfig.defaultQueue;
        this.concurrency = concurrency;
    }

    /**
     * Start listening for jobs on this worker's queue.
     */
    start(opts?: Partial<WorkerOptions>): Worker {
        if (this.worker) {
            console.warn(
                `[QueueWorker] Worker for "${this.queueName}" is already running`,
            );
            return this.worker;
        }

        this.worker = new Worker(
            this.queueName,
            async (bullJob: BullJob) => {
                await this.processJob(bullJob);
            },
            {
                connection: queueConfig.connection,
                prefix: queueConfig.prefix,
                concurrency: this.concurrency,
                ...opts,
            },
        );

        // ── Event listeners (Laravel-style logging) ─────────────────

        this.worker.on("completed", (job: BullJob) => {
            console.log(
                `[QueueWorker] ✓ ${job.name}#${job.id} completed on "${this.queueName}"`,
            );
        });

        this.worker.on("failed", (job: BullJob | undefined, err: Error) => {
            console.error(
                `[QueueWorker] ✗ ${job?.name}#${job?.id} failed on "${this.queueName}": ${err.message}`,
            );
            this.handleFailedJob(job, err);
        });

        this.worker.on("error", (err: Error) => {
            console.error(`[QueueWorker] Worker error: ${err.message}`);
        });

        console.log(
            `[QueueWorker] Listening on "${this.queueName}" (concurrency: ${this.concurrency})`,
        );

        return this.worker;
    }

    /**
     * Resolve the job class from the registry and invoke its `handle()`.
     */
    private async processJob(bullJob: BullJob): Promise<void> {
        const JobClass = resolveJob(bullJob.name);

        if (!JobClass) {
            throw new Error(
                `[QueueWorker] No handler registered for job "${bullJob.name}". ` +
                    `Did you forget to call registerJobs()?`,
            );
        }

        console.log(
            `[QueueWorker] Processing ${bullJob.name}#${bullJob.id} on "${this.queueName}"`,
        );

        // Instantiate the job and inject the BullMQ job reference
        const jobInstance = new JobClass();
        jobInstance.bullJob = bullJob;

        await jobInstance.handle();
    }

    /**
     * Call the job's `failed()` hook when all retries are exhausted.
     */
    private async handleFailedJob(
        bullJob: BullJob | undefined,
        error: Error,
    ): Promise<void> {
        if (!bullJob) return;

        const JobClass = resolveJob(bullJob.name);
        if (!JobClass) return;

        try {
            const jobInstance = new JobClass();
            jobInstance.bullJob = bullJob;
            await jobInstance.failed(error);
        } catch (hookErr) {
            console.error(
                `[QueueWorker] Error in failed() hook for ${bullJob.name}:`,
                hookErr,
            );
        }
    }

    /** Gracefully shut down the worker */
    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
            console.log(`[QueueWorker] Worker for "${this.queueName}" stopped`);
        }
    }
}
