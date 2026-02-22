import "reflect-metadata";
import { parentPort, workerData } from "worker_threads";
import dataSource from "../config/dataSource";
import { connectRedis } from "../config/redis";
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

    let offset = 0;
    let totalDispatched = 0;

    while (true) {
        const pages = await dataSource
            .getRepository(DocumentPage)
            .createQueryBuilder("page")
            .leftJoinAndSelect("page.document", "document")
            .where(
                "(page.lastCrawledAt IS NULL OR page.lastCrawledAt < :threshold)",
                { threshold: cooldownThreshold },
            )
            .skip(offset)
            .take(batchSize)
            .getMany();

        if (pages.length === 0) break;

        for (const page of pages) {
            await CrawlDocumentPageJob.dispatch({
                page,
                document: page.document,
            });
            totalDispatched++;

            // Wait between each dispatch to avoid spamming
            await sleep(delayBetweenMs);
        }

        offset += batchSize;
    }

    await dataSource.destroy();

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
