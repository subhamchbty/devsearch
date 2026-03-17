import { Crawlable } from "../crawlable.mixin";

// ── Concrete subclass for testing ─────────────────────────────────────────────

class TestCrawlable extends Crawlable {
    static override CRAWL_COOLDOWN_HOURS = 24;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Crawlable mixin", () => {
    describe("hoursSinceLastCrawl()", () => {
        it("returns null when lastCrawledAt is null", () => {
            const entity = new TestCrawlable();
            entity.lastCrawledAt = null;

            expect(entity.hoursSinceLastCrawl()).toBeNull();
        });

        it("returns ~0 when lastCrawledAt is just now", () => {
            const entity = new TestCrawlable();
            entity.lastCrawledAt = new Date();

            const hours = entity.hoursSinceLastCrawl();
            expect(hours).not.toBeNull();
            expect(hours!).toBeGreaterThanOrEqual(0);
            expect(hours!).toBeLessThan(0.01); // less than ~36 seconds
        });

        it("returns correct hours for a past timestamp", () => {
            const entity = new TestCrawlable();
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            entity.lastCrawledAt = twoHoursAgo;

            const hours = entity.hoursSinceLastCrawl();
            expect(hours).not.toBeNull();
            expect(hours!).toBeGreaterThanOrEqual(2);
            expect(hours!).toBeLessThan(2.01);
        });
    });

    describe("canCrawl()", () => {
        it("returns true when never crawled (lastCrawledAt is null)", () => {
            const entity = new TestCrawlable();
            entity.lastCrawledAt = null;

            expect(entity.canCrawl()).toBe(true);
        });

        it("returns true when last crawled more than cooldown hours ago", () => {
            const entity = new TestCrawlable();
            const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
            entity.lastCrawledAt = twentyFiveHoursAgo;

            expect(entity.canCrawl()).toBe(true);
        });

        it("returns false when last crawled less than cooldown hours ago", () => {
            const entity = new TestCrawlable();
            const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
            entity.lastCrawledAt = oneHourAgo;

            expect(entity.canCrawl()).toBe(false);
        });

        it("returns true just past the cooldown boundary (>= cooldown)", () => {
            const entity = new TestCrawlable();
            // Set to exactly 24 hours ago (just slightly over to avoid flakiness)
            const exactlyAtCooldown = new Date(Date.now() - 24 * 60 * 60 * 1000);
            entity.lastCrawledAt = exactlyAtCooldown;

            // hoursSinceLastCrawl will be >= 24 so canCrawl should be true
            expect(entity.canCrawl()).toBe(true);
        });

        it("respects a subclass-overridden CRAWL_COOLDOWN_HOURS", () => {
            class ShortCooldownCrawlable extends Crawlable {
                static override CRAWL_COOLDOWN_HOURS = 1; // 1 hour cooldown
            }

            const entity = new ShortCooldownCrawlable();
            // Set to 30 minutes ago — should not be crawlable with 1h cooldown
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            entity.lastCrawledAt = thirtyMinutesAgo;
            expect(entity.canCrawl()).toBe(false);

            // Set to 2 hours ago — should be crawlable
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            entity.lastCrawledAt = twoHoursAgo;
            expect(entity.canCrawl()).toBe(true);
        });
    });
});
