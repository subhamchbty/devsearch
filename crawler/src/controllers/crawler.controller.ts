import { Request, Response } from "express";
import dataSource from "../config/dataSource";
import { Document } from "../entities";
import { CrawlDocumentJob } from "../queue";

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
    const job = await CrawlDocumentJob.dispatch({ document });

    res.json({
        message: "Crawl job dispatched",
        jobId: job.id,
        queue: CrawlDocumentJob.queueName,
    });
};

export { triggerCrawl };
