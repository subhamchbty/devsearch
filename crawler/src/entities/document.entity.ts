import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { DocumentPage } from "./document-page.entity";

enum DocumentationType {
    LANGUAGE = "language",
    FRAMEWORK = "framework",
    LIBRARY = "library",
    TOOL = "tool",
}

@Entity("documents")
export class Document {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 255 })
    documentationOf: string;

    @Column({ type: "varchar", length: 20 })
    version: string;

    @Column({ type: "enum", enum: DocumentationType })
    type: DocumentationType;

    @Column({ type: "varchar", length: 255 })
    baseUrl: string;

    @Column({ type: "varchar", length: 255 })
    documentationUrl: string;

    @Column({ type: "timestamp", nullable: true })
    lastCrawledAt: Date | null;

    @OneToMany(() => DocumentPage, (page: DocumentPage) => page.document)
    pages: DocumentPage[];

    static CRAWL_COOLDOWN_HOURS = 24;

    /**
     * Returns the number of hours since the document was last crawled,
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
     * Returns `true` if the document can be crawled (never crawled or
     * cooldown period has elapsed).
     */
    canCrawl(): boolean {
        const hours = this.hoursSinceLastCrawl();
        return hours === null || hours >= Document.CRAWL_COOLDOWN_HOURS;
    }
}
