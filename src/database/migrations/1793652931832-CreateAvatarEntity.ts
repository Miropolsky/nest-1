import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAvatarEntity1793652931832 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN IF EXISTS "avatar"`,
    );
    await queryRunner.query(
      `CREATE TABLE "avatar_entity" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "fileName" character varying NOT NULL,
        "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_avatar_entity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_avatar_entity_user" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "avatar_entity"`);
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "avatar" character varying`,
    );
  }
}
