# ONE CS Platform — Remaining Work Agent Prompt

## Контекст проекта

ONE CS — full-stack платформа автоматизации (tRPC + Express + React), которая через Telegram-бота и browser automation получает кредитные данные, прогоняет через scoring engine и возвращает результат. Расположение: `/Users/user/Desktop/Проекты/csbot_admin/csbot_admin_system`.

## Что уже сделано

### Scoring Engine ✅
- Файл: `shared/oneCsScoring.ts`
- Алгоритм: `creditScore (300-850) → productScore (1-20) → baseQuality → completenessAdj → penalty → dataQualityScore (1-10) → status`
- 262 теста проходят
- Проверен на 35 реальных кредитных скорax (700-847) — все дают success, avg DQS 9.7/10

### Proxy (US routing) ✅
- Файл: `server/_core/proxy.ts`
- Evomi: `password_country-US@core-residential.evomi.com:1000` — 20/20 US
- Python bot: `cs_module/proxy/manager.py` — аналогичный формат
- 10+ летних стран протестировано, US единственный рабочий формат

### Legacy Python Bot ✅
- Бот `@asdscsscbot` (id: 8620486195) запускается
- 3 worker'а с camoufox browser automation
- ProxyManager работает (US-only роутинг)
- WorkerPool, queue, batch processor — исправлены syntax errors
- FSM flow для SSN

### Tests ✅
- 262 теста проходят, TypeScript чистый
- `server/oneCsScoring.userdata.test.ts` — 35 реальных скоров
- `server/oneCsScoring.realworld.test.ts` — 7 сценариев
- `server/_core/proxy.test.ts` — 6 тестов прокси
- `server/_core/health.test.ts` — 2 теста /health
- `server/restApi.test.ts`, `server/restApi.secret-validation.test.ts` — API тесты
- `server/platformService.test.ts` — 25 тестов сервиса

### Auth ✅
- `server/_core/auth.ts` — bcrypt + JWT (HS256, 1 год)
- `server/restApi.ts` — Bearer token, scope enforcement, rate limiting
- `server/auth.logout.test.ts` — logout тест

## Что НУЖНО сделать

### 1. API документация (OpenAPI/Swagger)

Документировать REST API (`/api/v1/*`):
- `POST /api/v1/requests/single` — одиночный запрос
- `POST /api/v1/requests/bulk` — массовый (до 1000 items)
- `POST /api/v1/requests/vip` — VIP priority
- `POST /api/v1/imported-data/preview` — превью PII-данных
- `POST /api/v1/imported-data/safe-batch` — безопасный batch
- `GET /api/v1/jobs/:publicId` — статус job
- `GET /api/v1/jobs/:publicId/events` — события job
- `GET /api/v1/usage/summary` — использование
- `GET /api/v1/health` — health check

Формат ответа:
```json
{
  "ok": true,
  "requestId": "req_...",
  "data": { ... },
  "meta": { ... }
}
```

Добавить Swagger UI endpoint (`/api/docs`).

### 2. Telegram Bot Integration (реальный)

Интегрировать бота `@asdscsscbot` в систему:
- tRPC процедура для отправки сообщений через bot API
- Обработка webhook от Telegram (или long polling)
- SSN FSM flow — когда бот запрашивает SSN, пользователь вводит, результат возвращается
- Batch result отправка в Telegram (CSV file)
- Перенести логику из `legacy_research/extracted/credit_score_bot/app/services/worker_pool.py` в `server/`

Проверить что бот отвечает на `/start`, `/help`.

### 3. Real Job Execution

Сейчас jobs выполняются в safe-test/mock режиме. Подключить реальное выполнение:
- Browser automation (camoufox) в `server/` — не только в legacy bot
- Proxy lease acquisition перед job
- Worker heartbeat + status updates
- Job events: `job.created`, `worker.started`, `proxy.leased`, `worker.completed`, `job.succeeded`

### 4. Rate Limiting в базу

Сейчас rate limiting в памяти (Map). Перенести в БД:
- Таблица `api_rate_limits` — key, minute_key, hits
- Redis fallback если Redis доступен
- Sliding window rate limiting

### 5. Платежи (Payments)

Добавить реальные платежи (сейчас mock):
- Stripe integration для покупки подписок
- Webhook обработка `invoice.paid`, `customer.subscription.updated`
- Таблица `payments` — полная схема
- Процедура `payments.list` с фильтрами

### 6. Webhooks для внешних систем

- `POST /api/v1/webhooks/job-completed` — notify external systems
- Подпись HMAC-SHA256 для verification
- Retry logic с exponential backoff

### 7. Алертинг и мониторинг

- `/metrics` endpoint (Prometheus format)
- Health check для всех подсистем
- Alert definitions: queue depth > 100, error rate > 5%, proxy latency > 2s
- Operator notification (Telegram) на critical events

### 8. Deployment

- Docker/Docker Compose (server + Redis + MySQL)
- Environment variables документация
- Health check endpoint для load balancer
- Graceful shutdown

## Ключевые файлы

- `server/platformService.ts` — бизнес-логика
- `server/restApi.ts` — REST endpoints
- `server/_core/proxy.ts` — proxy management
- `server/_core/auth.ts` — auth
- `drizzle/schema.ts` — DB schema
- `shared/oneCsScoring.ts` — scoring engine
- `shared/platform.ts` — Zod schemas
- `client/src/pages/Operations.tsx` — админка
- `legacy_research/extracted/credit_score_bot/` — Python Telegram bot

## Как работать

1. Каждый агент — независимая задача (1 агент = 1 задача из списка)
2. Перед правкой — перечитать файл
3. После правки — `pnpm check` + `pnpm test`
4. Все 262 теста должны оставаться зелёными
5. Если есть сомнения — спросить пользователя

## Принципы

- **Mock fallback**: если DB недоступна — in-memory runtimeStore
- **No breaking changes**: существующие 262 теста — constraint
- **US proxy only**: Evomi всегда с `_country-US` suffix
- **TypeScript strict**: `pnpm check` должен быть чистым

## Запуск

```bash
cd /Users/user/Desktop/Проекты/csbot_admin/csbot_admin_system
pnpm dev          # dev server
pnpm test         # все тесты
pnpm check        # TypeScript
```