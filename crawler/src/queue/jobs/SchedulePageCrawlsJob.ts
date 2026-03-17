import { IsNull, LessThan } from "typeorm";
import dataSource from "../../config/dataSource";
import { DocumentPage } from "../../entities/document-page.entity";
import { Job } from "../Job";
import { CrawlDocumentPageJob } from "./CrawlDocumentPageJob";

type SchedulePageCrawlsPayload = Record<string, never>;

/**
 * Dispatches a CrawlDocumentPageJob for every eligible DocumentPage in the
 * database. A page is eligible when it has never been crawled or its last
 * crawl is older than CRAWL_COOLDOWN_HOURS.
 * Intended to run on a repeating BullMQ schedule.
 *
 * Usage (once at startup):
 *   await SchedulePageCrawlsJob.schedule(86_400_000); // every 24 h
 */
export class SchedulePageCrawlsJob extends Job<SchedulePageCrawlsPayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    private get tag(): string {
        return `[SchedulePageCrawlsJob]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const threshold = new Date(
            Date.now() - DocumentPage.CRAWL_COOLDOWN_HOURS * 60 * 60 * 1000,
        );

        const pages = await dataSource.getRepository(DocumentPage).find({
            where: [
                { lastCrawledAt: IsNull() },
                { lastCrawledAt: LessThan(threshold) },
            ],
        });

        if (pages.length === 0) {
            console.log(`${this.tag} No eligible pages found, skipping`);
            return;
        }

        // Dispatch in batches to avoid overwhelming Redis with a single burst
        const BATCH_SIZE = 100;
        for (let i = 0; i < pages.length; i += BATCH_SIZE) {
            const batch = pages.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map((page) => CrawlDocumentPageJob.dispatch({ pageId: page.id })),
            );
        }

        console.log(`${this.tag} Dispatched ${pages.length} page crawl jobs`);
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
        await SchedulePageCrawlsJob.dispatch(
            {},
            { repeat: { every: ms, immediately: true } },
        );
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(`${this.tag} Permanently failed: ${error.message}`);
    }
}
