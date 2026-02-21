import express, { Express, Request, Response } from "express";
import "reflect-metadata";
import dataSource from "./config/dataSource";
import { connectRedis } from "./config/redis";
import router from "./routes";

const app: Express = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use("/api", router);

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "devsearch-crawler" });
});

dataSource
    .initialize()
    .then(async () => {
        console.log("Connected to the database");
        await connectRedis();
        app.listen(PORT, () => {
            console.log(`Crawler service running on http://localhost:${PORT}`);
        });
    })
    .catch((err: Error) => {
        console.error("Failed to connect to the database", err);
    });

export default app;
