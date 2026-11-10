import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenHashToUser1793569914635 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "refreshTokenHash" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN "refreshTokenHash"`,
    );
  }
}
