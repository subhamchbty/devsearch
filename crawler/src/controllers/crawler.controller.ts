import * as cheerio from "cheerio";
import { Request, Response } from "express";
import * as fs from "fs";

const triggerCrawl = async (_req: Request, res: Response) => {
    const crawlUrl = "https://laravel.com/docs/12.x";

    const downloadPage = async (url: string) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch ${url}: ${response.statusText}`,
                );
            }
            const html = await response.text();
            console.log(`Downloaded: ${url} (length: ${html.length})`);
            return html;
        } catch (error) {
            console.error(`Error downloading ${url}:`, error);
        }
    };

    const getBaseUrl = (url: string) => {
        try {
            const parsedUrl = new URL(url);
            return `${parsedUrl.protocol}//${parsedUrl.host}`;
        } catch (error) {
            console.error(`Invalid URL: ${url}`, error);
            return "";
        }
    };

    // const html = await downloadPage(crawlUrl);

    // save to a file for debugging
    // await fs.promises.writeFile(
    //     "tmp/crawled_laravel_page.html",
    //     html || "",
    //     "utf-8",
    // );

    const html = await fs.promises.readFile(
        "tmp/crawled_laravel_page.html",
        "utf-8",
    );

    const $ = cheerio.load(html);

    const contents = {
        framework: "Laravel",
        version: "12.x",
        baseUrl: getBaseUrl(crawlUrl),
        startUrl: crawlUrl,
        sections: [] as string[],
    };

    $("a").each((i, elem) => {
        let urls = $(elem).attr("href") || "";
        if (urls.startsWith("/")) {
            urls = contents.baseUrl + urls;
        }
        if (urls.startsWith(contents.baseUrl)) {
            contents.sections.push(urls);
        }
    });

    res.json({
        message: "Crawl completed",
        data: contents,
    });
};

export { triggerCrawl };
