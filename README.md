# nest-1

NestJS REST API: пользователи, аватары (MinIO), кэш и очередь (Redis), переводы денег и ночная очистка soft-deleted аватаров.

## Стек

- NestJS + TypeORM + PostgreSQL
- MinIO (`@aws-sdk/client-s3`)
- Redis: кэш (`@nestjs/cache-manager`) и очередь BullMQ
- `@nestjs/schedule` + BullMQ: фоновая очистка аватаров
- `nestjs-pino` + `nestjs-cls`: структурированные логи и `X-Request-ID`

## Локальный запуск

### 1. Зависимости

```bash
npm install
```

### 2. Переменные окружения

```bash
cp .env.example .env
```

Значения в `.env.example` совпадают с `docker-compose.yml`. Для MinIO используйте те же ключи, что и root-пользователь в compose:

| Переменная             | Значение из compose                |
| ---------------------- | ---------------------------------- |
| `S3_ACCESS_KEY_ID`     | `nestuser` (`MINIO_ROOT_USER`)     |
| `S3_SECRET_ACCESS_KEY` | `nestpass` (`MINIO_ROOT_PASSWORD`) |
| `S3_ENDPOINT`          | `http://localhost:9000`            |
| `S3_BUCKET`            | `avatars`                          |
| `S3_REGION`            | `us-east-1`                        |

PostgreSQL и Redis тоже берутся из compose: `nestuser` / `nestpass`, БД `nest1`, Redis `redis://localhost:6379`.

JWT-секреты в `.env.example` — только для локальной разработки; в репозиторий настоящие секреты не коммитьте.

### 3. Инфраструктура

```bash
docker compose up -d
```

Появятся:

- PostgreSQL — `localhost:5432`
- Redis — `localhost:6379`
- MinIO S3 API — `http://localhost:9000`
- MinIO console — `http://localhost:9001` (логин `nestuser`, пароль `nestpass`)
- `minio-init` создаст bucket `avatars`

Проверьте bucket в консоли MinIO: http://localhost:9001 → bucket `avatars`.

### 4. Миграции

```bash
npm run migration:run
```

Скрипт собирает проект и применяет миграции TypeORM из `src/database/migrations`.

### 5. Приложение и воркер

```bash
npm run start:dev
```

Один процесс поднимает HTTP API, cron и BullMQ worker. Отдельный воркер не нужен.

- API: http://localhost:3000
- Swagger: http://localhost:3000/api

Production:

```bash
npm run build
npm run start:prod
```

## Проверка загрузки аватара

1. Зарегистрируйтесь: `POST /auth/register`
2. Возьмите `access_token`
3. Загрузите JPEG/PNG до 10 МБ: `POST /avatars/upload-avatar` (`multipart/form-data`, поле `file`)
4. В MinIO console должен появиться объект вида `avatars/<uuid>.jpg`

Если MinIO отвечает `Access Denied` / `InvalidAccessKeyId`, сверьте `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY` с `nestuser` / `nestpass`.

## Аватары и очистка

- Загрузка: `POST /avatars/upload-avatar`
- Soft delete: `DELETE /avatars/delete-avatar/:id`
- Ручной запуск очистки: `POST /avatars/cleanup` → `202 Accepted`

Каждую ночь cron (`AVATAR_CLEANUP_CRON`, по умолчанию `0 3 * * *`) ставит ту же задачу в BullMQ. Воркер удаляет аватары с `deletedAt` старше `AVATAR_CLEANUP_RETENTION_DAYS` (по умолчанию `7`): сначала объект в MinIO, затем запись в PostgreSQL.

## Логирование

Каждый HTTP-запрос получает `X-Request-ID` из заголовка клиента или генерирует UUID. Тот же id возвращается в ответе и попадает в логи. Пароли, токены и `Authorization` редактируются.

## Команды

```bash
npm run lint
npm test
npm run test:e2e
npm run test:cov
npm run migration:run
npm run start:dev
npm run start:prod
```
