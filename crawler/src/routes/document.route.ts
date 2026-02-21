import express, { Router } from "express";
import { documentController } from "../controllers";

const router: Router = express.Router();

router.post("/", documentController.addNewDocument);
router.get("/", documentController.getDocuments);

export default router;
