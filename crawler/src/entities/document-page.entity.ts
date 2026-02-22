import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from "./document.entity";

@Entity("document_pages")
export class DocumentPage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 255, unique: true })
    url: string;

    @Column({ type: "text", nullable: true })
    content: string;

    @Column({ type: "boolean", default: false })
    isIndexed: boolean;

    @Column({ type: "timestamp", nullable: true })
    lastCrawledAt: Date;

    @Column({ type: "timestamp", nullable: true })
    lastVisitedAt: Date;

    @ManyToOne(() => Document, (document) => document.pages)
    document: Document;

    static CRAWL_COOLDOWN_HOURS = 24;

    /**
     * Returns the number of hours since the page was last crawled,
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
     * Returns `true` if the page can be crawled (cooldown period has elapsed).
     */
    canCrawl(): boolean {
        const hours = this.hoursSinceLastCrawl();
        return hours === null || hours >= DocumentPage.CRAWL_COOLDOWN_HOURS;
    }
}
