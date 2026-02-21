import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from "./document.entity";

@Entity("document_pages")
export class DocumentPage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 255 })
    url: string;

    @Column({ type: "text" })
    content: string;

    @ManyToOne(() => Document, (document) => document.pages)
    document: Document;
}
