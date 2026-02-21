import { Request, Response } from "express";
import { CrawlPageJob } from "../queue";

const triggerCrawl = async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
        res.status(400).json({ message: "Missing required query param: url" });
        return;
    }

    // Dispatch the job — it will be processed by the worker in the background
    const job = await CrawlPageJob.dispatch({ url });

    res.json({
        message: "Crawl job dispatched",
        jobId: job.id,
        queue: CrawlPageJob.queueName,
    });
};

export { triggerCrawl };
