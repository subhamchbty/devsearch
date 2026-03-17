import dataSource from "../../config/dataSource";
import { Document } from "../../entities";
import { Job } from "../Job";
import { CrawlDocumentJob } from "./CrawlDocumentJob";

type ScheduleCrawlsPayload = Record<string, never>;

/**
 * Dispatches a CrawlDocumentJob for every Document in the database.
 * Intended to run on a repeating BullMQ schedule.
 *
 * Usage (once at startup):
 *   await ScheduleCrawlsJob.schedule(86_400_000); // every 24 h
 */
export class ScheduleCrawlsJob extends Job<ScheduleCrawlsPayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    private get tag(): string {
        return `[ScheduleCrawlsJob]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const documents = await dataSource.getRepository(Document).find();

        if (documents.length === 0) {
            console.log(`${this.tag} No documents found, skipping`);
            return;
        }

        await Promise.all(
            documents.map((doc) => CrawlDocumentJob.dispatch({ documentId: doc.id })),
        );

        console.log(`${this.tag} Dispatched ${documents.length} crawl jobs`);
    }

    // ── Scheduling ──────────────────────────────────────────────────
    /**
     * Register this job as a BullMQ repeatable job.
     * `immediately: true` fires the job once right away on first schedule
     * (first deployment or Redis-cleared restart), then repeats every `ms`.
     * BullMQ deduplicates by name + repeat key, so calling this on every
     * normal restart is safe — the existing Redis entry is reused.
     */
    static async schedule(ms: number): Promise<void> {
        await ScheduleCrawlsJob.dispatch(
            {},
            { repeat: { every: ms, immediately: true } },
        );
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(`${this.tag} Permanently failed: ${error.message}`);
    }
}
