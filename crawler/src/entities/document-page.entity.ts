import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from "./document.entity";
import { Crawlable } from "./mixins/crawlable.mixin";

@Entity("document_pages")
export class DocumentPage extends Crawlable {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 255, unique: true })
    url: string;

    @Column({ type: "text", nullable: true })
    content: string;

    @Column({ type: "boolean", default: false })
    isIndexed: boolean;

    @Column({ type: "timestamp", nullable: true })
    lastVisitedAt: Date;

    @ManyToOne(() => Document, (document) => document.pages)
    document: Document;

    static override CRAWL_COOLDOWN_HOURS = 24;
}
