import { Request, Response } from "express";
import path from "path";
import { Worker } from "worker_threads";
import dataSource from "../config/dataSource";
import { Document, DocumentPage } from "../entities";
import { CrawlDocumentJob, CrawlDocumentPageJob } from "../queue";

const DELAY_BETWEEN_DISPATCHES_MS = 2 * 60 * 1000; // 2 minutes
const DISPATCH_BATCH_SIZE = 100;

const triggerCrawl = async (req: Request, res: Response) => {
    const { documentId } = req.params;

    if (!documentId) {
        res.status(400).json({
            message: "Missing required path param: documentId",
        });
        return;
    }

    const document = await dataSource
        .getRepository(Document)
        .findOneBy({ id: Number(documentId) });

    if (!document) {
        res.status(404).json({
            message: `Document with ID ${documentId} not found`,
        });
        return;
    }

    // Prevent re-crawling if cooldown period has not elapsed
    if (!document.canCrawl()) {
        res.status(429).json({
            message: `Document was crawled ${document.hoursSinceLastCrawl()!.toFixed(1)} hours ago. Please wait ${Document.CRAWL_COOLDOWN_HOURS} hours between crawls.`,
            lastCrawledAt: document.lastCrawledAt,
        });
        return;
    }

    // Dispatch the job — it will be processed by the worker in the background
    const job = await CrawlDocumentJob.dispatch({ documentId: document.id });

    res.json({
        message: "Crawl job dispatched",
        jobId: job.id,
        queue: CrawlDocumentJob.queueName,
    });
};

const triggerPageCrawl = async (_req: Request, res: Response) => {
    // Find all pages across all documents that are eligible for crawling
    const cooldownThreshold = new Date(
        Date.now() - DocumentPage.CRAWL_COOLDOWN_HOURS * 60 * 60 * 1000,
    );

    const pageCount = await dataSource
        .getRepository(DocumentPage)
        .createQueryBuilder("page")
        .where(
            "(page.lastCrawledAt IS NULL OR page.lastCrawledAt < :threshold)",
            { threshold: cooldownThreshold },
        )
        .getCount();

    if (pageCount === 0) {
        res.json({
            message: "No pages eligible for crawling",
            dispatched: 0,
        });
        return;
    }

    // Spawn a worker thread to handle dispatching in the background
    const workerFile = __filename.endsWith(".ts")
        ? "dispatchPageCrawls.worker.ts"
        : "dispatchPageCrawls.worker.js";
    const workerPath = path.resolve(__dirname, "../workers", workerFile);

    const worker = new Worker(workerPath, {
        workerData: {
            cooldownHours: Document.CRAWL_COOLDOWN_HOURS,
            delayBetweenMs: DELAY_BETWEEN_DISPATCHES_MS,
            batchSize: DISPATCH_BATCH_SIZE,
        },
        // Register ts-node so the worker can execute .ts files directly
        ...(workerFile.endsWith(".ts") && {
            execArgv: ["--require", "ts-node/register"],
        }),
    });

    worker.on("message", (msg) => {
        console.log(
            `[triggerPageCrawl] Worker finished: dispatched ${msg.dispatched} jobs (success: ${msg.success})`,
        );
    });

    worker.on("error", (err) => {
        console.error("[triggerPageCrawl] Worker error:", err);
    });

    // Respond immediately
    res.json({
        message: `Dispatching ${pageCount} page crawl jobs in a background worker`,
        eligible: pageCount,
        delayBetweenMs: DELAY_BETWEEN_DISPATCHES_MS,
        queue: CrawlDocumentPageJob.queueName,
    });
};

export { triggerCrawl, triggerPageCrawl };
