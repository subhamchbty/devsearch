// ── Mock QueueManager before any imports ─────────────────────────────────────

const mockAdd = jest.fn().mockResolvedValue({ id: "job-1" });
const mockGetQueue = jest.fn().mockReturnValue({ add: mockAdd });

jest.mock("../QueueManager", () => ({
    QueueManager: {
        getInstance: jest.fn().mockReturnValue({
            getQueue: mockGetQueue,
        }),
    },
}));

import { Job } from "../Job";

// ── Concrete test job ─────────────────────────────────────────────────────────

interface TestPayload {
    foo: string;
}

class TestJob extends Job<TestPayload> {
    static override queueName = "test-queue";
    static override attempts = 5;
    static override backoff = { type: "fixed" as const, delay: 500 };
    static override delay = 1000;

    async handle(): Promise<void> {
        // no-op
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    mockGetQueue.mockReturnValue({ add: mockAdd });
});

describe("Job base class", () => {
    describe("data getter", () => {
        it("returns the payload from bullJob.data", () => {
            const job = new TestJob();
            job.bullJob = { data: { foo: "bar" } } as any;

            expect(job.data).toEqual({ foo: "bar" });
        });
    });

    describe("failed()", () => {
        it("is a no-op by default and does not throw", async () => {
            const job = new TestJob();
            job.bullJob = { data: { foo: "test" } } as any;

            await expect(job.failed(new Error("test error"))).resolves.toBeUndefined();
        });
    });

    describe("dispatch()", () => {
        it("calls queue.add with the job class name and payload", async () => {
            await TestJob.dispatch({ foo: "hello" });

            expect(mockGetQueue).toHaveBeenCalledWith("test-queue");
            expect(mockAdd).toHaveBeenCalledWith(
                "TestJob",
                { foo: "hello" },
                expect.objectContaining({
                    attempts: 5,
                    backoff: { type: "fixed", delay: 500 },
                    delay: 1000,
                }),
            );
        });

        it("merges caller opts on top of the subclass defaults", async () => {
            await TestJob.dispatch({ foo: "override" }, { delay: 9999 });

            expect(mockAdd).toHaveBeenCalledWith(
                "TestJob",
                { foo: "override" },
                expect.objectContaining({ delay: 9999, attempts: 5 }),
            );
        });

        it("uses the subclass queueName when getting the queue", async () => {
            await TestJob.dispatch({ foo: "q" });

            expect(mockGetQueue).toHaveBeenCalledWith("test-queue");
        });
    });

    describe("dispatchOn()", () => {
        it("dispatches to the specified queue name instead of the default", async () => {
            await TestJob.dispatchOn("high-priority", { foo: "urgent" });

            expect(mockGetQueue).toHaveBeenCalledWith("high-priority");
            expect(mockAdd).toHaveBeenCalledWith(
                "TestJob",
                { foo: "urgent" },
                expect.objectContaining({ attempts: 5 }),
            );
        });
    });
});
