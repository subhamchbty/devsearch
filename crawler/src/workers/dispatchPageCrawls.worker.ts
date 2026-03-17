import "reflect-metadata";
import { parentPort, workerData } from "worker_threads";
import dataSource from "../config/dataSource";
import redisConnection, { connectRedis } from "../config/redis";
import { DocumentPage } from "../entities/document-page.entity";
import { CrawlDocumentPageJob } from "../queue/jobs/CrawlDocumentPageJob";

interface WorkerInput {
    cooldownHours: number;
    delayBetweenMs: number;
    batchSize: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    const { cooldownHours, delayBetweenMs, batchSize } =
        workerData as WorkerInput;

    await dataSource.initialize();
    await connectRedis();

    const cooldownThreshold = new Date(
        Date.now() - cooldownHours * 60 * 60 * 1000,
    );

    // Keyset pagination: track the last seen ID so pages crawled during
    // dispatch don't affect the result set of subsequent queries.
    let lastSeenId = 0;
    let totalDispatched = 0;

    while (true) {
        const pages = await dataSource
            .getRepository(DocumentPage)
            .createQueryBuilder("page")
            .select(["page.id"])
            .where(
                "page.id > :lastSeenId AND (page.lastCrawledAt IS NULL OR page.lastCrawledAt < :threshold)",
                { lastSeenId, threshold: cooldownThreshold },
            )
            .orderBy("page.id", "ASC")
            .take(batchSize)
            .getMany();

        if (pages.length === 0) break;

        for (const page of pages) {
            await CrawlDocumentPageJob.dispatch({ pageId: page.id });
            totalDispatched++;

            // Wait between each dispatch to avoid spamming
            await sleep(delayBetweenMs);
        }

        lastSeenId = pages[pages.length - 1].id;
    }

    await dataSource.destroy();
    await redisConnection.quit();

    parentPort?.postMessage({
        success: true,
        dispatched: totalDispatched,
    });
}

run().catch((err) => {
    console.error("[dispatchPageCrawls.worker] Fatal error:", err);
    parentPort?.postMessage({
        success: false,
        error: err.message,
        dispatched: 0,
    });
});
