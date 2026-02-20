import { DataSource } from "typeorm";

const dataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "devsearch",
    password: "devsearch",
    database: "devsearch",
});

export default dataSource;
