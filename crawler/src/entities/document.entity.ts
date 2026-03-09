import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { DocumentPage } from "./document-page.entity";
import { Crawlable } from "./mixins/crawlable.mixin";

export enum DocumentationType {
    LANGUAGE = "language",
    FRAMEWORK = "framework",
    LIBRARY = "library",
    TOOL = "tool",
}

@Entity("documents")
@Unique("UQ_documents_name_version", ["documentationOf", "version"])
export class Document extends Crawlable {
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

    static override CRAWL_COOLDOWN_HOURS = 24;
}
