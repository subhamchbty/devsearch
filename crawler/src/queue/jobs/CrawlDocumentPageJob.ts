import * as cheerio from "cheerio";
import { UnrecoverableError } from "bullmq";
import dataSource from "../../config/dataSource";
import { Document, DocumentPage } from "../../entities";
import { Job } from "../Job";

interface CrawlDocumentPagePayload {
    pageId: number;
}

interface DiscoveredPage {
    url: string;
    document: { id: number };
}

/**
 * Crawls an individual DocumentPage and discovers further in-scope pages
 * that are persisted to the database.
 *
 * Usage:
 *   await CrawlDocumentPageJob.dispatch({ pageId: 42 });
 */
export class CrawlDocumentPageJob extends Job<CrawlDocumentPagePayload> {
    // ── Configuration ───────────────────────────────────────────────
    static override queueName = "default";
    static override attempts = 3;
    static override backoff = { type: "exponential" as const, delay: 2000 };

    private get tag(): string {
        return `[CrawlDocumentPageJob][page:${this.data.pageId}]`;
    }

    // ── Handler ─────────────────────────────────────────────────────
    async handle(): Promise<void> {
        const { pageId } = this.data;

        const page = await dataSource
            .getRepository(DocumentPage)
            .findOne({ where: { id: pageId }, relations: ["document"] });

        if (!page) {
            throw new Error(`DocumentPage with ID ${pageId} not found`);
        }

        if (!page.canCrawl()) {
            console.log(
                `${this.tag} Skipping — last crawled ${page.hoursSinceLastCrawl()!.toFixed(1)}h ago`,
            );
            return;
        }

        const html = await this.fetchPage(page.url);
        const discoveredPages = this.extractPages(html, page.url, page.document);

        await this.markPageCrawled(pageId, html);
        await this.persistDiscoveredPages(discoveredPages);

        console.log(
            `${this.tag} Discovered ${discoveredPages.length} further pages from ${page.url}`,
        );
    }

    // ── Private helpers ─────────────────────────────────────────────

    /** Fetch the HTML content of a URL. */
    private async fetchPage(url: string): Promise<string> {
        console.log(`${this.tag} Fetching ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
                throw new UnrecoverableError(
                    `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
                );
            }
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        console.log(`${this.tag} Downloaded ${url} (${html.length} chars)`);
        return html;
    }

    /** Parse HTML and extract all in-scope links as new pages. */
    private extractPages(html: string, pageUrl: string, document: Document): DiscoveredPage[] {
        const $ = cheerio.load(html);
        const pages: DiscoveredPage[] = [];

        $("a").each((_i, elem) => {
            const href = $(elem).attr("href") || "";
            if (!href) return;

            let parsed: URL;
            try {
                parsed = new URL(href, pageUrl);
            } catch {
                return;
            }

            if (parsed.hash) return;

            const scope = document.documentationUrl.endsWith("/")
                ? document.documentationUrl
                : document.documentationUrl + "/";
            if (
                parsed.href !== document.documentationUrl &&
                !parsed.href.startsWith(scope)
            )
                return;

            const resolvedUrl = parsed.href;

            // Do NOT set lastCrawledAt here — these pages have only been
            // discovered, not crawled. lastCrawledAt is set in markPageCrawled()
            // after the page is actually fetched.
            pages.push({
                url: resolvedUrl,
                document: { id: document.id },
            });
        });

        return [...new Map(pages.map((p) => [p.url, p])).values()];
    }

    /** Update the page's lastCrawledAt timestamp, content, and lastVisitedAt. */
    private async markPageCrawled(pageId: number, html: string): Promise<void> {
        const now = new Date();
        await dataSource.getRepository(DocumentPage).update(pageId, {
            lastCrawledAt: now,
            lastVisitedAt: now,
            content: html,
        });
    }

    /** Upsert any newly discovered pages into the database. */
    private async persistDiscoveredPages(
        pages: DiscoveredPage[],
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
