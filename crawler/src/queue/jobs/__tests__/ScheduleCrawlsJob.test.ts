import { Document } from "../../../entities/document.entity";

// ── Mock dataSource ────────────────────────────────────────────────────────────

const mockDocumentFind = jest.fn();

jest.mock("../../../config/dataSource", () => ({
    __esModule: true,
    default: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === Document || entity?.name === "Document") {
                return { find: mockDocumentFind };
            }
            throw new Error(`Unexpected entity: ${entity?.name}`);
        }),
    },
}));

// ── Mock CrawlDocumentJob.dispatch ─────────────────────────────────────────────

const mockDispatch = jest.fn().mockResolvedValue({ id: "mock-job-id" });

jest.mock("../CrawlDocumentJob", () => ({
    CrawlDocumentJob: { dispatch: (...args: any[]) => mockDispatch(...args) },
}));

import { ScheduleCrawlsJob } from "../ScheduleCrawlsJob";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDocument(id: number): Document {
    const doc = new Document();
    doc.id = id;
    return doc;
}

function makeJob(): ScheduleCrawlsJob {
    const job = new ScheduleCrawlsJob();
    job.bullJob = {
        data: {},
        id: "test-bull-id",
        name: "ScheduleCrawlsJob",
        attemptsMade: 0,
        opts: { attempts: 3 },
    } as any;
    return job;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe("ScheduleCrawlsJob.handle()", () => {
    it("does not dispatch any jobs when there are no documents", async () => {
        mockDocumentFind.mockResolvedValue([]);

        const job = makeJob();
        await job.handle();

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("dispatches one CrawlDocumentJob per document with the correct documentId", async () => {
        mockDocumentFind.mockResolvedValue([
            makeDocument(10),
            makeDocument(20),
            makeDocument(30),
        ]);

        const job = makeJob();
        await job.handle();

        expect(mockDispatch).toHaveBeenCalledTimes(3);
        expect(mockDispatch).toHaveBeenCalledWith({ documentId: 10 });
        expect(mockDispatch).toHaveBeenCalledWith({ documentId: 20 });
        expect(mockDispatch).toHaveBeenCalledWith({ documentId: 30 });
    });
});

describe("ScheduleCrawlsJob.failed()", () => {
    it("logs without throwing", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const job = makeJob();
        await expect(
            job.failed(new Error("something went wrong")),
        ).resolves.toBeUndefined();

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("something went wrong"),
        );

        consoleSpy.mockRestore();
    });
});

describe("ScheduleCrawlsJob.schedule()", () => {
    it("dispatches with repeat every and immediately options", async () => {
        const mockDispatchStatic = jest
            .spyOn(ScheduleCrawlsJob, "dispatch")
            .mockResolvedValue({ id: "repeat-job-id" } as any);

        await ScheduleCrawlsJob.schedule(3600000);

        expect(mockDispatchStatic).toHaveBeenCalledWith(
            {},
            { repeat: { every: 3600000, immediately: true } },
        );

        mockDispatchStatic.mockRestore();
    });
});
