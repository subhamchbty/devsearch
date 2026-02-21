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

    @OneToMany(() => DocumentPage, (page: DocumentPage) => page.document)
    pages: DocumentPage[];
}
