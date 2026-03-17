import { IsNull } from "typeorm";
import { DocumentPage } from "../../../entities/document-page.entity";

// ── Mock dataSource ────────────────────────────────────────────────────────────

const mockPageFind = jest.fn();

jest.mock("../../../config/dataSource", () => ({
    __esModule: true,
    default: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === DocumentPage || entity?.name === "DocumentPage") {
                return { find: mockPageFind };
            }
            throw new Error(`Unexpected entity: ${entity?.name}`);
        }),
    },
}));

// ── Mock CrawlDocumentPageJob.dispatch ─────────────────────────────────────────

const mockDispatch = jest.fn().mockResolvedValue({ id: "mock-job-id" });

jest.mock("../CrawlDocumentPageJob", () => ({
    CrawlDocumentPageJob: { dispatch: (...args: any[]) => mockDispatch(...args) },
}));

import { SchedulePageCrawlsJob } from "../SchedulePageCrawlsJob";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePage(id: number): DocumentPage {
    const page = new DocumentPage();
    page.id = id;
    return page;
}

function makeJob(): SchedulePageCrawlsJob {
    const job = new SchedulePageCrawlsJob();
    job.bullJob = {
        data: {},
        id: "test-bull-id",
        name: "SchedulePageCrawlsJob",
        attemptsMade: 0,
        opts: { attempts: 3 },
    } as any;
    return job;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe("SchedulePageCrawlsJob.handle()", () => {
    it("does not dispatch any jobs when there are no eligible pages", async () => {
        mockPageFind.mockResolvedValue([]);

        const job = makeJob();
        await job.handle();

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("dispatches one CrawlDocumentPageJob per eligible page with the correct pageId", async () => {
        mockPageFind.mockResolvedValue([makePage(10), makePage(20), makePage(30)]);

        const job = makeJob();
        await job.handle();

        expect(mockDispatch).toHaveBeenCalledTimes(3);
        expect(mockDispatch).toHaveBeenCalledWith({ pageId: 10 });
        expect(mockDispatch).toHaveBeenCalledWith({ pageId: 20 });
        expect(mockDispatch).toHaveBeenCalledWith({ pageId: 30 });
    });

    it("queries only eligible pages using the cooldown threshold", async () => {
        mockPageFind.mockResolvedValue([]);

        const job = makeJob();
        await job.handle();

        expect(mockPageFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.arrayContaining([
                    { lastCrawledAt: IsNull() },
                    { lastCrawledAt: expect.anything() }, // LessThan(threshold)
                ]),
            }),
        );
    });
});

describe("SchedulePageCrawlsJob.schedule()", () => {
    it("dispatches with repeat every and immediately options", async () => {
        const mockDispatchStatic = jest
            .spyOn(SchedulePageCrawlsJob, "dispatch")
            .mockResolvedValue({ id: "repeat-job-id" } as any);

        await SchedulePageCrawlsJob.schedule(3600000);

        expect(mockDispatchStatic).toHaveBeenCalledWith(
            {},
            { repeat: { every: 3600000, immediately: true } },
        );

        mockDispatchStatic.mockRestore();
    });
});

describe("SchedulePageCrawlsJob.failed()", () => {
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
