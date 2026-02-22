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

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    lastCrawledAt: Date;

    @Column({ type: "timestamp", nullable: true })
    lastVisitedAt: Date;

    @ManyToOne(() => Document, (document) => document.pages)
    document: Document;
}
