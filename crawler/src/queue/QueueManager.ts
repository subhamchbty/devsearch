import { Queue } from "bullmq";
import queueConfig from "./QueueConfig";

/**
 * Manages BullMQ Queue instances (singleton per queue name).
 * Laravel equivalent: Illuminate\Queue\QueueManager
 *
 * Queues are created lazily the first time they are requested.
 */
export class QueueManager {
    private static instance: QueueManager;
    private queues: Map<string, Queue> = new Map();

    private constructor() {}

    /** Get the singleton QueueManager instance */
    static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }

    /**
     * Get (or create) a BullMQ Queue for the given name.
     * If no name is supplied, the default queue is returned.
     */
    getQueue(name?: string): Queue {
        const queueName = name || queueConfig.defaultQueue;

        if (!this.queues.has(queueName)) {
            const queue = new Queue(queueName, {
                connection: queueConfig.connection,
                prefix: queueConfig.prefix,
                defaultJobOptions: {
                    attempts: queueConfig.defaultAttempts,
                    backoff: queueConfig.defaultBackoff,
                    removeOnComplete: { count: 1000 },
                    removeOnFail: { count: 5000 },
                },
            });

            this.queues.set(queueName, queue);
            console.log(`[QueueManager] Queue "${queueName}" registered`);
        }

        return this.queues.get(queueName)!;
    }

    /** List all registered queue names */
    getRegisteredQueues(): string[] {
        return Array.from(this.queues.keys());
    }

    /** Gracefully close all queue connections */
    async closeAll(): Promise<void> {
        const closing = Array.from(this.queues.values()).map((q) => q.close());
        await Promise.all(closing);
        this.queues.clear();
        console.log("[QueueManager] All queues closed");
    }
}
