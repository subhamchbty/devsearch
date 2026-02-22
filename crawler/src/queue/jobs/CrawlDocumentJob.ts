import * as cheerio from "cheerio";
import dataSource from "../../config/dataSource";
import { Document, DocumentPage } from "../../entities";
import { Job } from "../Job";

interface CrawlDocumentPayload {
    document: Document;
    depth?: number;
}

interface CrawledPage {
    url: string;
    lastCrawledAt: Date;
    document: Document;
}

/**
 * Example job: Crawls a document.
 *
 * Usage:
 *   await CrawlDocumentJob.dispatch({ documentId: "123" });
 *   await CrawlDocumentJob.dispatch({ documentId: "123", depth: 2 }, { delay: 5000 });
 */
export class CrawlDocumentJob extends Job<CrawlDocumentPayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { document, depth } = this.data;

        // Re-check the cooldown from the DB (in case the job was queued before the check)
        const freshDocument = await dataSource
            .getRepository(Document)
            .findOneBy({ id: document.id });

        if (freshDocument && !freshDocument.canCrawl()) {
            console.log(
                `[CrawlDocumentJob] Skipping document ${document.id} — last crawled ${freshDocument.hoursSinceLastCrawl()!.toFixed(1)}h ago`,
            );
            return;
        }

        console.log(
            `[CrawlDocumentJob] Crawling document ${document.id} (depth: ${depth ?? 0})`,
        );

        const response = await fetch(document.documentationUrl);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch ${document.documentationUrl}: ${response.statusText}`,
            );
        }

        const html = await response.text();
        console.log(
            `[CrawlDocumentJob] Downloaded ${document.documentationUrl} (${html.length} chars)`,
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

        await dataSource.getRepository(Document).update(document.id, {
            lastCrawledAt: new Date(),
        });

        console.log(
            `[CrawlDocumentJob] Extracted ${pages.length} pages from ${document.documentationUrl}`,
        );
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(
            `[CrawlDocumentJob] Permanently failed for document ${this.data.document.id}: ${error.message}`,
        );
        // TODO: Send notification, log to DB, etc.
    }
}
