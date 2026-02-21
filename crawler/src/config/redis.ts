import IORedis from "ioredis";

const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true, // Don't connect until we explicitly call .connect()
});

redisConnection.on("error", (err) => {
    console.error("Redis connection error:", err);
});

export async function connectRedis() {
    try {
        await redisConnection.connect();
        console.log("Connected to Redis");
    } catch (err) {
        console.error("Failed to connect to Redis", err);
        process.exit(1);
    }
}

export default redisConnection;
