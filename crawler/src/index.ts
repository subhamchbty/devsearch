import "dotenv/config";
import express, { Express, Request, Response } from "express";
import http from "http";
import "reflect-metadata";
import dataSource from "./config/dataSource";
import { connectRedis } from "./config/redis";
import { bootQueue, QueueManager, QueueWorker, ScheduleCrawlsJob } from "./queue";
import router from "./routes";

const app: Express = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use("/api", router);

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "devsearch-crawler" });
});

dataSource
    .initialize()
    .then(async () => {
        console.log("Connected to the database");
        await connectRedis();

        // Boot the queue system — register jobs & start workers
        const workers: QueueWorker[] = bootQueue({
            queues: ["default"],
            concurrency: 2,
        });

        // Schedule automatic crawls if configured
        const scheduleMs = parseInt(process.env.CRAWL_SCHEDULE_MS ?? "", 10);
        if (!isNaN(scheduleMs) && scheduleMs > 0) {
            try {
                await ScheduleCrawlsJob.schedule(scheduleMs);
                console.log(`[Scheduler] Crawl scheduled every ${scheduleMs}ms`);
            } catch (err) {
                console.error("[Scheduler] Failed to register crawl schedule:", err);
            }
        } else {
            console.log(
                "[Scheduler] CRAWL_SCHEDULE_MS not set — scheduled crawling disabled",
            );
        }

        const server = http.createServer(app);

        server.listen(PORT, () => {
            console.log(`Crawler service running on http://localhost:${PORT}`);
        });

        /** Gracefully shut down the server, queue workers, and DB connection. */
        const shutdown = async (signal: string) => {
            console.log(
                `[shutdown] Received ${signal}. Shutting down gracefully...`,
            );

            server.close(async () => {
                console.log("[shutdown] HTTP server closed");

                for (const worker of workers) {
                    await worker.stop();
                }
                console.log("[shutdown] All queue workers stopped");

                await QueueManager.getInstance().closeAll();
                console.log("[shutdown] All queue connections closed");

                await dataSource.destroy();
                console.log("[shutdown] Database connection closed");

                process.exit(0);
            });
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    })
    .catch((err: Error) => {
        console.error("Failed to connect to the database", err);
    });

export default app;
