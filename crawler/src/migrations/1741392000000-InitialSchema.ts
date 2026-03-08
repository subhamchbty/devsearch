import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1741392000000 implements MigrationInterface {
    name = "InitialSchema1741392000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Create documents table ───────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "public"."documents_type_enum" AS ENUM(
                'language',
                'framework',
                'library',
                'tool'
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "documents" (
                "id"               SERIAL                              NOT NULL,
                "documentationOf"  character varying(255)              NOT NULL,
                "version"          character varying(20)               NOT NULL,
                "type"             "public"."documents_type_enum"      NOT NULL,
                "baseUrl"          character varying(255)              NOT NULL,
                "documentationUrl" character varying(255)              NOT NULL,
                "lastCrawledAt"    TIMESTAMP,
                CONSTRAINT "PK_documents" PRIMARY KEY ("id")
            )
        `);

        // ── Create document_pages table ──────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "document_pages" (
                "id"            SERIAL                 NOT NULL,
                "url"           character varying(255) NOT NULL,
                "content"       text,
                "isIndexed"     boolean                NOT NULL DEFAULT false,
                "lastCrawledAt" TIMESTAMP,
                "lastVisitedAt" TIMESTAMP,
                "documentId"    integer,
                CONSTRAINT "UQ_document_pages_url" UNIQUE ("url"),
                CONSTRAINT "PK_document_pages"      PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "document_pages"
                ADD CONSTRAINT "FK_document_pages_document"
                FOREIGN KEY ("documentId")
                REFERENCES "documents" ("id")
                ON DELETE NO ACTION
                ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "document_pages"
                DROP CONSTRAINT "FK_document_pages_document"
        `);
        await queryRunner.query(`DROP TABLE "document_pages"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP TYPE "public"."documents_type_enum"`);
    }
}
