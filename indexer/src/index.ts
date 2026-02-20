import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "devsearch-indexer" });
});

app.listen(PORT, () => {
    console.log(`Indexer service running on http://localhost:${PORT}`);
});

export default app;
