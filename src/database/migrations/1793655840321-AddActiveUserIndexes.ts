import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveUserIndexes1793655840321 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_avatar_active_user_uploaded" ON "avatar_entity" ("user_id", "uploadedAt" DESC) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_active_age" ON "user_entity" ("age") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_active_age"`);
    await queryRunner.query(`DROP INDEX "IDX_avatar_active_user_uploaded"`);
  }
}
