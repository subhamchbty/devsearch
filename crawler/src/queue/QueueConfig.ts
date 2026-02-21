import { ConnectionOptions } from "bullmq";
import redisConnection from "../config/redis";

/**
 * Central queue configuration.
 * Mirrors Laravel's config/queue.php approach.
 */
export interface QueueConfigOptions {
    /** Default queue name when none is specified */
    defaultQueue: string;
    /** BullMQ connection (IORedis instance or connection options) */
    connection: ConnectionOptions;
    /** Default number of retry attempts */
    defaultAttempts: number;
    /** Default back-off strategy */
    defaultBackoff: {
        type: "exponential" | "fixed";
        delay: number; // ms
    };
    /** Prefix for all queue keys in Redis */
    prefix: string;
}

const queueConfig: QueueConfigOptions = {
    defaultQueue: "default",
    connection: redisConnection,
    defaultAttempts: 3,
    defaultBackoff: {
        type: "exponential",
        delay: 1000,
    },
    prefix: "devsearch",
};

export default queueConfig;
