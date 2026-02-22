import express, { Router } from "express";
import { crawlerController } from "../controllers";

const router: Router = express.Router();

router.get("/:documentId/trigger-crawl", crawlerController.triggerCrawl);

export default router;
