import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserEntity1793567513400 implements MigrationInterface {
  name = 'CreateUserEntity1793567513400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_entity" (
        "id" SERIAL NOT NULL,
        "login" character varying NOT NULL,
        "age" integer NOT NULL,
        "description" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_b54f8ea623b17094db7667d8206" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_e74b542753b5bf00d728607f81a" UNIQUE ("login"),
        CONSTRAINT "UQ_415c35b9b3b6fe45a3b065030f5" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_entity"`);
  }
}
