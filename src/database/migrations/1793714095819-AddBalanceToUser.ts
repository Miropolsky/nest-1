import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceToUser1793714095819 implements MigrationInterface {
  name = 'AddBalanceToUser1793714095819';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "balance" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD CONSTRAINT "CHK_5b3e270614225e161df6cb09f7" CHECK (balance >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP CONSTRAINT "CHK_5b3e270614225e161df6cb09f7"`,
    );
    await queryRunner.query(`ALTER TABLE "user_entity" DROP COLUMN "balance"`);
  }
}
