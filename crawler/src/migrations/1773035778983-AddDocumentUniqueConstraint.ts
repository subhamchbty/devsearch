import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentUniqueConstraint1773035778983 implements MigrationInterface {
    name = "AddDocumentUniqueConstraint1773035778983";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documents"
                ADD CONSTRAINT "UQ_documents_name_version"
                UNIQUE ("documentationOf", "version")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documents"
                DROP CONSTRAINT "UQ_documents_name_version"
        `);
    }
}
