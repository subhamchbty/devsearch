import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "devsearch-embedder" });
});

app.listen(PORT, () => {
    console.log(`Embedder service running on http://localhost:${PORT}`);
});

export default app;
