import express, { Router } from "express";
import crawlerRouter from "./crawler.route";
import documentRouter from "./document.route";

const router: Router = express.Router();

router.use("/documents", documentRouter);
router.use("/crawler", crawlerRouter);

export default router;
