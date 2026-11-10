import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarToUser1793567513444 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "avatar" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "avatar"`);
  }
}
