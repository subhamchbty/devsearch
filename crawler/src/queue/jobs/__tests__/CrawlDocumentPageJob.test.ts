// ── Mock dataSource before any imports ───────────────────────────────────────

import { Document } from "../../../entities/document.entity";
import { DocumentPage } from "../../../entities/document-page.entity";

const mockDocumentPageFindOne = jest.fn();
const mockDocumentPageUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocumentPageUpsert = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../config/dataSource", () => ({
    __esModule: true,
    default: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === DocumentPage || entity?.name === "DocumentPage") {
                return {
                    findOne: mockDocumentPageFindOne,
                    update: mockDocumentPageUpdate,
                    upsert: mockDocumentPageUpsert,
                };
            }
            throw new Error(`Unexpected entity in getRepository: ${entity?.name}`);
        }),
    },
}));

import { CrawlDocumentPageJob } from "../CrawlDocumentPageJob";

// ── HTML fixture ───────────────────────────────────────────────────────────────

const FIXTURE_HTML = `<html><body>
  <a href="/docs/api">API</a>
  <a href="https://external.com">External</a>
  <a href="/docs/guide">Guide</a>
  <a href="/docs/api">API duplicate</a>
  <a href="">Empty</a>
  <a href="#section">Fragment only</a>
  <a href="/docs/api#overview">Fragment with path</a>
  <a href="/docs-legacy/api">Other version</a>
</body></html>`;

const BASE_URL = "https://react.dev";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParentDocument(overrides: Partial<Document> = {}): Document {
    const doc = new Document();
    doc.id = 10;
    doc.baseUrl = BASE_URL;
    doc.documentationUrl = `${BASE_URL}/docs`;
    doc.lastCrawledAt = null;
    return Object.assign(doc, overrides);
}

function makePage(overrides: Partial<DocumentPage> = {}): DocumentPage {
    const page = new DocumentPage();
    page.id = 42;
    page.url = `${BASE_URL}/docs/intro`;
    page.lastCrawledAt = null; // never crawled → canCrawl() === true
    page.document = makeParentDocument();
    return Object.assign(page, overrides);
}

function makeJob(pageId: number = 42): CrawlDocumentPageJob {
    const job = new CrawlDocumentPageJob();
    job.bullJob = {
        data: { pageId },
        id: "test-bull-id",
        name: "CrawlDocumentPageJob",
        attemptsMade: 0,
        opts: { attempts: 3 },
    } as any;
    return job;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe("CrawlDocumentPageJob.handle()", () => {
    it("throws an error when the page is not found", async () => {
        mockDocumentPageFindOne.mockResolvedValue(null);

        const job = makeJob(999);

        await expect(job.handle()).rejects.toThrow(
            "DocumentPage with ID 999 not found",
        );
    });

    it("uses findOne with relations to load the document", async () => {
        const page = makePage({ lastCrawledAt: new Date() }); // canCrawl() false
        mockDocumentPageFindOne.mockResolvedValue(page);

        const job = makeJob();
        await job.handle();

        expect(mockDocumentPageFindOne).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42 },
                relations: ["document"],
            }),
        );
    });

    it("skips crawling when canCrawl() returns false", async () => {
        const recentlyCrawled = makePage({
            lastCrawledAt: new Date(), // just now → canCrawl() === false
        });
        mockDocumentPageFindOne.mockResolvedValue(recentlyCrawled);

        const job = makeJob();

        await expect(job.handle()).resolves.toBeUndefined();
        expect(mockDocumentPageUpdate).not.toHaveBeenCalled();
    });

    it("fetches the page URL", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        const mockFetch = jest
            .spyOn(global, "fetch")
            .mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue("<html></html>"),
            } as any);

        const job = makeJob();
        await job.handle();

        expect(mockFetch).toHaveBeenCalledWith(page.url);
    });

    it("throws a retryable error on 5xx responses", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
        } as any);

        const job = makeJob();

        await expect(job.handle()).rejects.toThrow(/Failed to fetch/);
    });

    it("throws an UnrecoverableError on 4xx responses (no retry)", async () => {
        const { UnrecoverableError } = await import("bullmq");
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
        } as any);

        const job = makeJob();

        await expect(job.handle()).rejects.toThrow(UnrecoverableError);
    });

    it("extracts in-scope links, deduplicates, ignores external and empty hrefs", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(FIXTURE_HTML),
        } as any);

        const job = makeJob();
        await job.handle();

        expect(mockDocumentPageUpsert).toHaveBeenCalledTimes(1);
        const [pages] = mockDocumentPageUpsert.mock.calls[0];

        const urls: string[] = pages.map((p: any) => p.url);
        expect(urls).toContain(`${BASE_URL}/docs/api`);
        expect(urls).toContain(`${BASE_URL}/docs/guide`);
        expect(urls).not.toContain("https://external.com");
        expect(urls).not.toContain("");
        expect(urls.some((u) => u.includes("#"))).toBe(false); // fragment URLs excluded
        expect(urls).not.toContain(`${BASE_URL}/docs-legacy/api`); // out-of-scope version
        expect(urls).toHaveLength(2); // deduplication: /docs/api appears twice
    });

    it("handles zero in-scope links gracefully (no upsert called)", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(
                `<html><body><a href="https://external.com">Ext</a></body></html>`,
            ),
        } as any);

        const job = makeJob();
        await job.handle();

        expect(mockDocumentPageUpsert).not.toHaveBeenCalled();
    });

    it("calls markPageCrawled BEFORE persistDiscoveredPages", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        const callOrder: string[] = [];
        mockDocumentPageUpdate.mockImplementation(() => {
            callOrder.push("markPageCrawled");
            return Promise.resolve();
        });
        mockDocumentPageUpsert.mockImplementation(() => {
            callOrder.push("persistDiscoveredPages");
            return Promise.resolve();
        });

        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(FIXTURE_HTML),
        } as any);

        const job = makeJob();
        await job.handle();

        expect(callOrder).toEqual(["markPageCrawled", "persistDiscoveredPages"]);
    });

    it("updates lastCrawledAt, content, and lastVisitedAt on the page (not the document)", async () => {
        const page = makePage();
        mockDocumentPageFindOne.mockResolvedValue(page);

        const HTML = "<html><body>hello</body></html>";
        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(HTML),
        } as any);

        const job = makeJob();
        await job.handle();

        expect(mockDocumentPageUpdate).toHaveBeenCalledWith(
            page.id,
            expect.objectContaining({
                lastCrawledAt: expect.any(Date),
                lastVisitedAt: expect.any(Date),
                content: HTML,
            }),
        );
    });

    describe("failed()", () => {
        it("logs without throwing", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            const job = makeJob();
            job.bullJob = {
                data: { pageId: 42 },
                id: "fail-id",
                name: "CrawlDocumentPageJob",
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
