import * as cheerio from "cheerio";
import dataSource from "../../config/dataSource";
import { Document, DocumentPage } from "../../entities";
import { Job } from "../Job";

interface CrawlPagePayload {
    document: Document;
    depth?: number;
}

interface CrawledPage {
    url: string;
    lastCrawledAt: Date;
    document: Document;
}

/**
 * Example job: Crawls a single page.
 *
 * Usage:
 *   await CrawlPageJob.dispatch({ documentId: "123" });
 *   await CrawlPageJob.dispatch({ documentId: "123", depth: 2 }, { delay: 5000 });
 */
export class CrawlPageJob extends Job<CrawlPagePayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { document, depth } = this.data;
        console.log(
            `[CrawlPageJob] Crawling document ${document.id} (depth: ${depth ?? 0})`,
        );

        const response = await fetch(document.documentationUrl);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch ${document.documentationUrl}: ${response.statusText}`,
            );
        }

        const html = await response.text();
        console.log(
            `[CrawlPageJob] Downloaded ${document.documentationUrl} (${html.length} chars)`,
        );

        const $ = cheerio.load(html);

        const pages: CrawledPage[] = [];

        $("a").each((i, elem) => {
            let url = $(elem).attr("href") || "";
            if (url.startsWith("/")) {
                url = document.documentationUrl + url;
            }

            if (!url.startsWith(document.baseUrl)) {
                return;
            }

            pages.push({
                url,
                lastCrawledAt: new Date(),
                document: { id: document.id } as Document,
            });
        });

        const uniquePages = [...new Map(pages.map((p) => [p.url, p])).values()];

        await dataSource.getRepository(DocumentPage).upsert(uniquePages, {
            conflictPaths: ["url"],
            skipUpdateIfNoValuesChanged: true,
        });
        console.log(
            `[CrawlPageJob] Extracted ${pages.length} pages from ${document.documentationUrl}`,
        );
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(
            `[CrawlPageJob] Permanently failed for document ${this.data.document.id}: ${error.message}`,
        );
        // TODO: Send notification, log to DB, etc.
    }
}
