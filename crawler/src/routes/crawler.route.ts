import express, { Router } from "express";
import { crawlerController } from "../controllers";

const router: Router = express.Router();

router.get("/:documentId/trigger-crawl", crawlerController.triggerCrawl);
router.get("/trigger-page-crawl", crawlerController.triggerPageCrawl);

export default router;
