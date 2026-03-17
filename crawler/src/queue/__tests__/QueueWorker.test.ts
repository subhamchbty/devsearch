// ── Mocks — must be declared before imports ───────────────────────────────────

// Capture processor and event handlers from Worker constructor
let capturedProcessor: ((bullJob: any) => Promise<void>) | null = null;
const capturedEventHandlers: Record<string, ((...args: any[]) => void)[]> = {};

const mockWorkerClose = jest.fn().mockResolvedValue(undefined);
const mockWorkerOn = jest.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
    if (!capturedEventHandlers[event]) {
        capturedEventHandlers[event] = [];
    }
    capturedEventHandlers[event].push(handler);
});

const mockWorkerConstructor = jest.fn().mockImplementation(
    (_queueName: string, processor: (bullJob: any) => Promise<void>) => {
        capturedProcessor = processor;
        return {
            close: mockWorkerClose,
            on: mockWorkerOn,
        };
    },
);

jest.mock("bullmq", () => ({
    Worker: mockWorkerConstructor,
}));

jest.mock("../QueueConfig", () => ({
    __esModule: true,
    default: {
        defaultQueue: "default",
        connection: { host: "localhost", port: 6379 },
        prefix: "devsearch",
        concurrency: 1,
    },
}));

const mockResolveJob = jest.fn();

jest.mock("../JobRegistry", () => ({
    resolveJob: (...args: any[]) => mockResolveJob(...args),
}));

import { Job } from "../Job";
import { QueueWorker } from "../QueueWorker";

// ── Helpers ───────────────────────────────────────────────────────────────────

class FakeJob extends Job<{ id: number }> {
    handle = jest.fn().mockResolvedValue(undefined);
    failed = jest.fn().mockResolvedValue(undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    capturedProcessor = null;
    Object.keys(capturedEventHandlers).forEach((k) => delete capturedEventHandlers[k]);
});

describe("QueueWorker", () => {
    describe("start()", () => {
        it("creates a Worker with correct queue name and connection options", () => {
            const worker = new QueueWorker("my-queue", 2);
            worker.start();

            expect(mockWorkerConstructor).toHaveBeenCalledWith(
                "my-queue",
                expect.any(Function),
                expect.objectContaining({
                    connection: expect.anything(),
                    prefix: "devsearch",
                    concurrency: 2,
                }),
            );
        });

        it("does not create a second Worker if already started", () => {
            const worker = new QueueWorker("my-queue");
            worker.start();
            worker.start(); // second call — should be a no-op

            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
        });

        it("registers 'completed', 'failed', and 'error' event handlers", () => {
            const worker = new QueueWorker("events-queue");
            worker.start();

            expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));
            expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
            expect(mockWorkerOn).toHaveBeenCalledWith("error", expect.any(Function));
        });
    });

    describe("processJob (via captured processor)", () => {
        it("resolves the job class and calls handle()", async () => {
            const fakeJobInstance = new FakeJob();
            const FakeJobClass = jest.fn().mockReturnValue(fakeJobInstance);
            mockResolveJob.mockReturnValue(FakeJobClass);

            const worker = new QueueWorker("proc-queue");
            worker.start();

            const bullJob = { name: "FakeJob", id: "42", data: { id: 1 } };
            await capturedProcessor!(bullJob);

            expect(mockResolveJob).toHaveBeenCalledWith("FakeJob");
            expect(FakeJobClass).toHaveBeenCalledTimes(1);
            expect(fakeJobInstance.bullJob).toBe(bullJob);
            expect(fakeJobInstance.handle).toHaveBeenCalledTimes(1);
        });

        it("throws an error when job name is not registered", async () => {
            mockResolveJob.mockReturnValue(undefined);

            const worker = new QueueWorker("proc-queue");
            worker.start();

            const bullJob = { name: "UnknownJob", id: "99", data: {} };
            await expect(capturedProcessor!(bullJob)).rejects.toThrow(
                /No handler registered for job "UnknownJob"/,
            );
        });
    });

    describe("handleFailedJob (via 'failed' event handler)", () => {
        it("calls job's failed() hook when all retries are exhausted", async () => {
            const fakeJobInstance = new FakeJob();
            const FakeJobClass = jest.fn().mockReturnValue(fakeJobInstance);
            mockResolveJob.mockReturnValue(FakeJobClass);

            const worker = new QueueWorker("fail-queue");
            worker.start();

            const bullJob = {
                name: "FakeJob",
                id: "10",
                data: { id: 1 },
                attemptsMade: 3,
                opts: { attempts: 3 },
            };
            const error = new Error("permanent failure");

            // Invoke the 'failed' event handler directly
            const handlers = capturedEventHandlers["failed"];
            const failedHandler = handlers[handlers.length - 1];
            failedHandler(bullJob, error);

            // Allow microtasks to settle
            await new Promise((r) => setImmediate(r));

            expect(fakeJobInstance.failed).toHaveBeenCalledWith(error);
        });

        it("skips the failed() hook when retries remain", async () => {
            const fakeJobInstance = new FakeJob();
            const FakeJobClass = jest.fn().mockReturnValue(fakeJobInstance);
            mockResolveJob.mockReturnValue(FakeJobClass);

            const worker = new QueueWorker("fail-queue");
            worker.start();

            const bullJob = {
                name: "FakeJob",
                id: "11",
                data: { id: 1 },
                attemptsMade: 1, // only 1 attempt made, 3 allowed
                opts: { attempts: 3 },
            };
            const error = new Error("transient failure");

            const handlers = capturedEventHandlers["failed"];
            const failedHandler = handlers[handlers.length - 1];
            failedHandler(bullJob, error);

            await new Promise((r) => setImmediate(r));

            expect(fakeJobInstance.failed).not.toHaveBeenCalled();
        });
    });

    describe("stop()", () => {
        it("calls worker.close() and sets internal worker to null", async () => {
            const worker = new QueueWorker("stop-queue");
            worker.start();

            await worker.stop();

            expect(mockWorkerClose).toHaveBeenCalledTimes(1);
        });

        it("is safe to call when the worker was never started", async () => {
            const worker = new QueueWorker("stop-queue");

            // Should not throw
            await expect(worker.stop()).resolves.toBeUndefined();
            expect(mockWorkerClose).not.toHaveBeenCalled();
        });
    });
});
