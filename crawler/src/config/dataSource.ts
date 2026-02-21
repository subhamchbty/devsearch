import { DataSource } from "typeorm";

const dataSource = new DataSource({
    type: (process.env.CRAWLER_DB_DRIVER as any) || "postgres",
    host: process.env.CRAWLER_DB_HOST || "localhost",
    port: parseInt(process.env.CRAWLER_DB_PORT as string, 10) || 5432,
    username: process.env.CRAWLER_DB_USERNAME || "devsearch",
    password: process.env.CRAWLER_DB_PASSWORD || "devsearch",
    database: process.env.CRAWLER_DB_NAME || "devsearch",
});

export default dataSource;
