import express, { Router } from "express";
import crawlerRouter from "./crawler.route";

const router: Router = express.Router();

router.use("/crawl", crawlerRouter);

export default router;
