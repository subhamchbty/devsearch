import express, { Router } from "express";
import { crawlerController } from "../controllers";

const router: Router = express.Router();

router.post("/:documentId/trigger-crawl", crawlerController.triggerCrawl);
router.post("/trigger-page-crawl", crawlerController.triggerPageCrawl);

export default router;
