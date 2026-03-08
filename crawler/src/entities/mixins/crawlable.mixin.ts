import { Column } from "typeorm";

/**
 * Abstract base class that provides shared crawl-cooldown logic.
 *
 * Extend this class in any entity that needs to track crawl state
 * and enforce a cooldown period between crawls.
 */
export abstract class Crawlable {
    static CRAWL_COOLDOWN_HOURS = 24;

    @Column({ type: "timestamp", nullable: true })
    lastCrawledAt: Date | null;

    /**
     * Returns the number of hours since the entity was last crawled,
     * or `null` if it has never been crawled.
     */
    hoursSinceLastCrawl(): number | null {
        if (!this.lastCrawledAt) return null;
        return (
            (Date.now() - new Date(this.lastCrawledAt).getTime()) /
            (1000 * 60 * 60)
        );
    }

    /**
     * Returns `true` if the entity can be crawled (never crawled or
     * cooldown period has elapsed).
     */
    canCrawl(): boolean {
        const hours = this.hoursSinceLastCrawl();
        // Each subclass should override CRAWL_COOLDOWN_HOURS if needed.
        // We access the static property via the constructor to support overrides.
        const cooldown = (this.constructor as typeof Crawlable)
            .CRAWL_COOLDOWN_HOURS;
        return hours === null || hours >= cooldown;
    }
}
