import { Job } from "../Job";

interface CrawlPagePayload {
    url: string;
    depth?: number;
}

/**
 * Example job: Crawls a single page.
 *
 * Usage:
 *   await CrawlPageJob.dispatch({ url: "https://laravel.com/docs/12.x" });
 *   await CrawlPageJob.dispatch({ url: "...", depth: 2 }, { delay: 5000 });
 */
export class CrawlPageJob extends Job<CrawlPagePayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { url, depth } = this.data;
        console.log(`[CrawlPageJob] Crawling ${url} (depth: ${depth ?? 0})`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch ${url}: ${response.statusText}`,
            );
        }

        const html = await response.text();
        console.log(
            `[CrawlPageJob] Downloaded ${url} (${html.length} chars)`,
        );

        // TODO: Parse links, store content, dispatch child jobs, etc.
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(
            `[CrawlPageJob] Permanently failed for ${this.data.url}: ${error.message}`,
        );
        // TODO: Send notification, log to DB, etc.
    }
}
