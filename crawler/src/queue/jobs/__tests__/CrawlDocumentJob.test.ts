// ── Mock dataSource before any imports ───────────────────────────────────────

import { Document } from "../../../entities/document.entity";
import { DocumentPage } from "../../../entities/document-page.entity";

const mockDocumentFindOneBy = jest.fn();
const mockDocumentUpdate = jest.fn().mockResolvedValue(undefined);

const mockDocumentPageUpsert = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../config/dataSource", () => ({
    __esModule: true,
    default: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === Document || entity?.name === "Document") {
                return {
                    findOneBy: mockDocumentFindOneBy,
                    update: mockDocumentUpdate,
                };
            }
            if (entity === DocumentPage || entity?.name === "DocumentPage") {
                return {
                    upsert: mockDocumentPageUpsert,
                };
            }
            throw new Error(`Unexpected entity in getRepository: ${entity?.name}`);
        }),
    },
}));

import { CrawlDocumentJob } from "../CrawlDocumentJob";

// ── HTML fixture ───────────────────────────────────────────────────────────────

const FIXTURE_HTML = `<html><body>
  <a href="/docs/api">API</a>
  <a href="https://external.com">External</a>
  <a href="/docs/guide">Guide</a>
  <a href="/docs/api">API duplicate</a>
  <a href="">Empty</a>
</body></html>`;

const BASE_URL = "https://react.dev";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDocument(overrides: Partial<Document> = {}): Document {
    const doc = new Document();
    doc.id = 1;
    doc.baseUrl = BASE_URL;
    doc.documentationUrl = `${BASE_URL}/reference/react`;
    doc.lastCrawledAt = null; // never crawled → canCrawl() === true
    return Object.assign(doc, overrides);
}

function makeJob(documentId: number = 1): CrawlDocumentJob {
    const job = new CrawlDocumentJob();
    job.bullJob = {
        data: { documentId },
        id: "test-bull-id",
        name: "CrawlDocumentJob",
        attemptsMade: 0,
        opts: { attempts: 3 },
    } as any;
    return job;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe("CrawlDocumentJob.handle()", () => {
    it("throws an error when the document is not found", async () => {
        mockDocumentFindOneBy.mockResolvedValue(null);

        const job = makeJob(999);

        await expect(job.handle()).rejects.toThrow("Document with ID 999 not found");
    });

    it("skips crawling when canCrawl() returns false", async () => {
        const recentlyCrawled = makeDocument({
            lastCrawledAt: new Date(), // just now → canCrawl() === false
        });
        mockDocumentFindOneBy.mockResolvedValue(recentlyCrawled);

        const fetchSpy = jest
            .spyOn(global, "fetch")
            .mockResolvedValue({ ok: true, text: jest.fn() } as any);

        const job = makeJob();

        // Should resolve without fetching anything
        await expect(job.handle()).resolves.toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();

        fetchSpy.mockRestore();
    });

    it("fetches the documentationUrl", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue("<html></html>"),
        });
        global.fetch = mockFetch as any;

        const job = makeJob();
        await job.handle();

        expect(mockFetch).toHaveBeenCalledWith(doc.documentationUrl);

        delete (global as any).fetch;
    });

    it("throws when the fetch response is not OK", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            statusText: "Not Found",
        }) as any;

        const job = makeJob();

        await expect(job.handle()).rejects.toThrow(/Failed to fetch/);

        delete (global as any).fetch;
    });

    it("extracts in-scope links, deduplicates, ignores external and empty hrefs", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(FIXTURE_HTML),
        }) as any;

        const job = makeJob();
        await job.handle();

        expect(mockDocumentPageUpsert).toHaveBeenCalledTimes(1);
        const [pages] = mockDocumentPageUpsert.mock.calls[0];

        const urls: string[] = pages.map((p: any) => p.url);
        expect(urls).toContain(`${BASE_URL}/docs/api`);
        expect(urls).toContain(`${BASE_URL}/docs/guide`);
        expect(urls).not.toContain("https://external.com");
        expect(urls).not.toContain(""); // empty href
        expect(urls).toHaveLength(2); // deduplication: /docs/api appears twice

        delete (global as any).fetch;
    });

    it("handles zero in-scope links gracefully (no upsert called)", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(
                `<html><body><a href="https://external.com">Ext</a></body></html>`,
            ),
        }) as any;

        const job = makeJob();
        await job.handle();

        // persistPages early-returns when pages.length === 0
        expect(mockDocumentPageUpsert).not.toHaveBeenCalled();

        delete (global as any).fetch;
    });

    it("updates lastCrawledAt on the document after crawling", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue("<html></html>"),
        }) as any;

        const job = makeJob();
        await job.handle();

        expect(mockDocumentUpdate).toHaveBeenCalledWith(
            doc.id,
            expect.objectContaining({ lastCrawledAt: expect.any(Date) }),
        );

        delete (global as any).fetch;
    });

    it("persists pages (upsert) BEFORE marking document crawled (update) — ensures re-crawlability on mid-run crash", async () => {
        const doc = makeDocument();
        mockDocumentFindOneBy.mockResolvedValue(doc);

        const callOrder: string[] = [];
        mockDocumentPageUpsert.mockImplementation(() => {
            callOrder.push("upsert");
            return Promise.resolve();
        });
        mockDocumentUpdate.mockImplementation(() => {
            callOrder.push("update");
            return Promise.resolve();
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(FIXTURE_HTML),
        }) as any;

        const job = makeJob();
        await job.handle();

        expect(callOrder).toEqual(["upsert", "update"]);

        delete (global as any).fetch;
    });

    describe("failed()", () => {
        it("logs without throwing", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            const job = makeJob();
            job.bullJob = {
                data: { documentId: 1 },
                id: "fail-id",
                name: "CrawlDocumentJob",
            } as any;

            await expect(
                job.failed(new Error("something went wrong")),
            ).resolves.toBeUndefined();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("something went wrong"),
            );

            consoleSpy.mockRestore();
        });
    });
});
