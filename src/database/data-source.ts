import { DataSource } from 'typeorm';
import { databaseConfigFromEnv } from '../config/database.config.js';

const database = databaseConfigFromEnv();

export default new DataSource({
  type: 'postgres',
  host: database.host,
  port: database.port,
  username: database.user,
  password: database.password,
  database: database.name,
  migrations: ['dist/database/migrations/*.js'],
  entities: ['dist/**/*.entity.js'],
});
