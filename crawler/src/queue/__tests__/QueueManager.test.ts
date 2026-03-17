// ── Mocks — must be declared before imports ───────────────────────────────────

const mockQueueClose = jest.fn().mockResolvedValue(undefined);
const mockQueueConstructor = jest.fn().mockImplementation(() => ({
    close: mockQueueClose,
}));

jest.mock("bullmq", () => ({
    Queue: mockQueueConstructor,
}));

jest.mock("../QueueConfig", () => ({
    __esModule: true,
    default: {
        defaultQueue: "default",
        connection: { host: "localhost", port: 6379 },
        prefix: "devsearch",
        defaultAttempts: 3,
        defaultBackoff: { type: "exponential", delay: 1000 },
    },
}));

import { QueueManager } from "../QueueManager";

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton between tests
    (QueueManager as any).instance = undefined;
});

describe("QueueManager", () => {
    describe("singleton behaviour", () => {
        it("returns the same instance on repeated calls", () => {
            const a = QueueManager.getInstance();
            const b = QueueManager.getInstance();

            expect(a).toBe(b);
        });
    });

    describe("getQueue()", () => {
        it("creates a new Queue on first request", () => {
            const manager = QueueManager.getInstance();
            manager.getQueue("jobs");

            expect(mockQueueConstructor).toHaveBeenCalledTimes(1);
            expect(mockQueueConstructor).toHaveBeenCalledWith(
                "jobs",
                expect.objectContaining({
                    connection: expect.anything(),
                    prefix: "devsearch",
                }),
            );
        });

        it("returns the same Queue instance on subsequent calls for the same name", () => {
            const manager = QueueManager.getInstance();
            const first = manager.getQueue("jobs");
            const second = manager.getQueue("jobs");

            expect(first).toBe(second);
            expect(mockQueueConstructor).toHaveBeenCalledTimes(1);
        });

        it("uses the configured default queue name when no name is supplied", () => {
            const manager = QueueManager.getInstance();
            manager.getQueue();

            expect(mockQueueConstructor).toHaveBeenCalledWith(
                "default",
                expect.anything(),
            );
        });

        it("passes correct defaultJobOptions to the Queue constructor", () => {
            const manager = QueueManager.getInstance();
            manager.getQueue("options-check");

            expect(mockQueueConstructor).toHaveBeenCalledWith(
                "options-check",
                expect.objectContaining({
                    defaultJobOptions: expect.objectContaining({
                        attempts: 3,
                        backoff: { type: "exponential", delay: 1000 },
                        removeOnComplete: { count: 1000 },
                        removeOnFail: { count: 5000 },
                    }),
                }),
            );
        });
    });

    describe("getRegisteredQueues()", () => {
        it("returns an empty array when no queues have been requested", () => {
            const manager = QueueManager.getInstance();

            expect(manager.getRegisteredQueues()).toEqual([]);
        });

        it("returns all queue names that have been requested", () => {
            const manager = QueueManager.getInstance();
            manager.getQueue("queue-a");
            manager.getQueue("queue-b");

            const names = manager.getRegisteredQueues();
            expect(names).toContain("queue-a");
            expect(names).toContain("queue-b");
            expect(names).toHaveLength(2);
        });
    });

    describe("closeAll()", () => {
        it("calls close() on every registered queue", async () => {
            const manager = QueueManager.getInstance();
            manager.getQueue("q1");
            manager.getQueue("q2");

            await manager.closeAll();

            expect(mockQueueClose).toHaveBeenCalledTimes(2);
        });

        it("clears the internal queues map after closing", async () => {
            const manager = QueueManager.getInstance();
            manager.getQueue("q1");

            await manager.closeAll();

            expect(manager.getRegisteredQueues()).toEqual([]);
        });
    });
});
