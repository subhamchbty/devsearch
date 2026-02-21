import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
}
