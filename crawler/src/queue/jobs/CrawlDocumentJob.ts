import * as cheerio from "cheerio";
import dataSource from "../../config/dataSource";
import { Document, DocumentPage } from "../../entities";
import { Job } from "../Job";

interface CrawlDocumentPayload {
    documentId: number;
    depth?: number;
}

interface CrawledPage {
    url: string;
    document: { id: number };
}

/**
 * Crawls a documentation source by fetching the documentation URL,
 * extracting all in-scope page links, and persisting them to the database.
 *
 * Usage:
 *   await CrawlDocumentJob.dispatch({ documentId: 123 });
 *   await CrawlDocumentJob.dispatch({ documentId: 123, depth: 2 }, { delay: 5000 });
 */
export class CrawlDocumentJob extends Job<CrawlDocumentPayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    private get tag(): string {
        return `[CrawlDocumentJob][doc:${this.data.documentId}]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { documentId } = this.data;

        const document = await dataSource
            .getRepository(Document)
            .findOneBy({ id: documentId });

        if (!document) {
            throw new Error(`Document with ID ${documentId} not found`);
        }

        if (!document.canCrawl()) {
            console.log(
                `${this.tag} Skipping — last crawled ${document.hoursSinceLastCrawl()!.toFixed(1)}h ago`,
            );
            return;
        }

        const html = await this.fetchPage(document.documentationUrl);
        const pages = this.extractPages(html, document);

        await this.persistPages(pages);
        await this.markDocumentCrawled(documentId);

        console.log(`${this.tag} Extracted ${pages.length} pages`);
    }

    // ── Private helpers ─────────────────────────────────────────────

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
            const href = $(elem).attr("href") || "";
            if (!href) return;

            let parsed: URL;
            try {
                parsed = new URL(href, document.baseUrl);
            } catch {
                return;
            }

            if (parsed.hash) return;
            if (!parsed.href.startsWith(document.baseUrl)) return;

            const resolvedUrl = parsed.href;

            pages.push({
                url: resolvedUrl,
                document: { id: document.id },
            });
        });

        return [...new Map(pages.map((p) => [p.url, p])).values()];
    }

    /** Upsert discovered pages into the database. */
    private async persistPages(pages: CrawledPage[]): Promise<void> {
        if (pages.length === 0) return;
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
    }
}
