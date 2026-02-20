import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "devsearch-crawler" });
});

app.listen(PORT, () => {
    console.log(`Crawler service running on http://localhost:${PORT}`);
});

export default app;
