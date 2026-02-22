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

    private get tag(): string {
        return `[CrawlDocumentJob][doc:${this.data.document.id}]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { document } = this.data;

        if (await this.isCooldownActive(document.id)) return;

        const html = await this.fetchPage(document.documentationUrl);
        const pages = this.extractPages(html, document);

        await this.persistPages(pages);
        await this.markDocumentCrawled(document.id);

        console.log(`${this.tag} Extracted ${pages.length} pages`);
    }

    // ── Private helpers ─────────────────────────────────────────────

    /** Re-check the cooldown from the DB in case the job was queued before the controller check. */
    private async isCooldownActive(documentId: number): Promise<boolean> {
        const freshDocument = await dataSource
            .getRepository(Document)
            .findOneBy({ id: documentId });

        if (freshDocument && !freshDocument.canCrawl()) {
            console.log(
                `${this.tag} Skipping — last crawled ${freshDocument.hoursSinceLastCrawl()!.toFixed(1)}h ago`,
            );
            return true;
        }
        return false;
    }

    /** Fetch the HTML content of a URL. */
    private async fetchPage(url: string): Promise<string> {
        console.log(`${this.tag} Fetching ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const html = await response.text();
        console.log(`${this.tag} Downloaded ${url} (${html.length} chars)`);
        return html;
    }

    /** Parse HTML and extract all in-scope links as crawled pages. */
    private extractPages(html: string, document: Document): CrawledPage[] {
        const $ = cheerio.load(html);
        const pages: CrawledPage[] = [];

        $("a").each((_i, elem) => {
            let url = $(elem).attr("href") || "";
            if (url.startsWith("/")) {
                url = document.documentationUrl + url;
            }
            if (!url.startsWith(document.baseUrl)) return;

            pages.push({
                url,
                lastCrawledAt: new Date(),
                document: { id: document.id } as Document,
            });
        });

        return [...new Map(pages.map((p) => [p.url, p])).values()];
    }

    /** Upsert discovered pages into the database. */
    private async persistPages(pages: CrawledPage[]): Promise<void> {
        await dataSource.getRepository(DocumentPage).upsert(pages, {
            conflictPaths: ["url"],
            skipUpdateIfNoValuesChanged: true,
        });
    }

    /** Update the document's lastCrawledAt timestamp. */
    private async markDocumentCrawled(documentId: number): Promise<void> {
        await dataSource.getRepository(Document).update(documentId, {
            lastCrawledAt: new Date(),
        });
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(`${this.tag} Permanently failed: ${error.message}`);
        // TODO: Send notification, log to DB, etc.
    }
}
