import express, { Router } from "express";
import { crawlerController } from "../controllers";

const router: Router = express.Router();

router.get("/", crawlerController.triggerCrawl);
router.post("/", crawlerController.addNewDocument);

export default router;
