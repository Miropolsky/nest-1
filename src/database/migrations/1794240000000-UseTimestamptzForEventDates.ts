import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseTimestamptzForEventDates1794240000000 implements MigrationInterface {
  name = 'UseTimestamptzForEventDates1794240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_entity"
      ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ
      USING "deletedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "avatar_entity"
      ALTER COLUMN "uploadedAt" TYPE TIMESTAMPTZ
      USING "uploadedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "avatar_entity"
      ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ
      USING "deletedAt" AT TIME ZONE 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "avatar_entity"
      ALTER COLUMN "deletedAt" TYPE TIMESTAMP
      USING "deletedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "avatar_entity"
      ALTER COLUMN "uploadedAt" TYPE TIMESTAMP
      USING "uploadedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_entity"
      ALTER COLUMN "deletedAt" TYPE TIMESTAMP
      USING "deletedAt" AT TIME ZONE 'UTC'
    `);
  }
}
