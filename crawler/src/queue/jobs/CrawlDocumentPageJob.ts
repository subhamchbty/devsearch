import * as cheerio from "cheerio";
import dataSource from "../../config/dataSource";
import { Document, DocumentPage } from "../../entities";
import { Job } from "../Job";

interface CrawlDocumentPagePayload {
    page: DocumentPage;
    document: Document;
}

/**
 * Crawls an individual DocumentPage and
 * discovers further in-scope pages that are persisted to the database.
 *
 * Usage:
 *   await CrawlDocumentPageJob.dispatch({ page, document });
 */
export class CrawlDocumentPageJob extends Job<CrawlDocumentPagePayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    private get tag(): string {
        return `[CrawlDocumentPageJob][page:${this.data.page.id}]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { page, document } = this.data;

        if (await this.isCooldownActive(page.id)) return;

        const html = await this.fetchPage(page.url);
        const discoveredPages = this.extractPages(html, document);

        await this.markPageCrawled(page.id);
        await this.persistDiscoveredPages(discoveredPages);

        console.log(
            `${this.tag} Discovered ${discoveredPages.length} further pages from ${page.url}`,
        );
    }

    // ── Private helpers ─────────────────────────────────────────────

    /** Re-check the cooldown from the DB in case the job was queued before the check. */
    private async isCooldownActive(pageId: number): Promise<boolean> {
        const freshPage = await dataSource
            .getRepository(DocumentPage)
            .findOneBy({ id: pageId });

        if (freshPage && !freshPage.canCrawl()) {
            console.log(
                `${this.tag} Skipping — last crawled ${freshPage.hoursSinceLastCrawl()!.toFixed(1)}h ago`,
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

    /** Parse HTML and extract all in-scope links as new pages. */
    private extractPages(
        html: string,
        document: Document,
    ): { url: string; lastCrawledAt: Date; document: Document }[] {
        const $ = cheerio.load(html);
        const pages: {
            url: string;
            lastCrawledAt: Date;
            document: Document;
        }[] = [];

        $("a").each((_i, elem) => {
            let url = $(elem).attr("href") || "";
            if (url.startsWith("/")) {
                url = document.baseUrl + url;
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

    /** Update the page's lastCrawledAt timestamp. */
    private async markPageCrawled(pageId: number): Promise<void> {
        await dataSource.getRepository(DocumentPage).update(pageId, {
            lastCrawledAt: new Date(),
        });
    }

    /** Upsert any newly discovered pages into the database. */
    private async persistDiscoveredPages(
        pages: { url: string; lastCrawledAt: Date; document: Document }[],
    ): Promise<void> {
        if (pages.length === 0) return;
        await dataSource.getRepository(DocumentPage).upsert(pages, {
            conflictPaths: ["url"],
            skipUpdateIfNoValuesChanged: true,
        });
    }

    // ── Failed hook ─────────────────────────────────────────────────
    async failed(error: Error): Promise<void> {
        console.error(`${this.tag} Permanently failed: ${error.message}`);
    }
}
