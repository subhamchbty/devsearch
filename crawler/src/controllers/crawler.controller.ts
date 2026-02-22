import { Request, Response } from "express";
import dataSource from "../config/dataSource";
import { Document } from "../entities";
import { CrawlPageJob } from "../queue";

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

    // Dispatch the job — it will be processed by the worker in the background
    const job = await CrawlPageJob.dispatch({ document });

    res.json({
        message: "Crawl job dispatched",
        jobId: job.id,
        queue: CrawlPageJob.queueName,
    });
};

export { triggerCrawl };
