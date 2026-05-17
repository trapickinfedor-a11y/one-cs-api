# ONE CS — Master TODO

> ONE CS Admin System. Платформа кредитных проверок с админ-панелью, ботом, прокси и биллингом.

---

## ✅ Завершено

### Core
- [x] Доменная модель + DB schema (users, jobs, payments, api_keys, subscriptions)
- [x] Jobs/Queue backend + REST API (single/bulk/VIP)
- [x] ONE CS scoring (data quality 1-10, credit score 300-850, adverse reasons)
- [x] Safe test bench (mock-данные)

### Admin UI
- [x] Overview (KPI, operator action queue, incident snapshot)
- [x] Jobs section
- [x] Proxy Providers section
- [x] Workers section
- [x] Billing section (revenue analytics, payments)
- [x] Metrics section (success rate, health, COGS)
- [x] System section (readiness, rollback runbook)
- [x] Safe Bench section (отдельный маршрут)
- [x] Logs section (audit trail, filters)
- [x] API Keys management (list/create/revoke)
- [x] Bot Texts management
- [x] Broadcasts management

### Backend
- [x] tRPC procedures для всех секций
- [x] API keys auth (Bearer parsing + validation)
- [x] Bot texts storage + CRUD
- [x] Broadcasts storage + send

### Deployment
- [x] Production deploy на 193.221.200.87 (port 3112)
- [x] nginx upstream cutover + rollback drill
- [x] systemd service (csbot.service)
- [x] Post-deploy verification

### Tests
- [x] Vitest 51+ tests passing
- [x] Regression coverage
- [x] Admin UI states (loading/error/empty)
- [x] Operations sections tests

---

## 🔴 Приоритет P0

### Proxy Layer
- [ ] Proxy-layer с адаптерами Evomi и DataImpulse
- [ ] Sticky/rotating режимы
- [ ] Health checks
- [ ] Fallback-переключение провайдера
- [ ] Учёт трафика

### Worker Pool
- [ ] Worker pool с execution-контуром
- [ ] Retry-политики
- [ ] Журналирование выполнения
- [ ] Персистентные переходы статусов
- [ ] Очереди/диспетчеризация

---

## 🟡 Приоритет P1

### Billing & Subscriptions
- [ ] Система подписок и тарифных планов
- [ ] Metering
- [ ] BTCPay Server integration
- [ ] Crypto Bot integration

### Telegram
- [ ] Telegram-интеграция для уведомлений владельца
- [ ] Системные события
- [ ] Пользовательские взаимодействия

### ONE CS Bot (5.252.153.40)
- [ ] Подключение к серверу
- [ ] 5 отдельных Evomi sticky sessions
- [ ] Тестовый bot-flow
- [ ] Ротация/обработка сбоев

---

## 🟢 Приоритет P2

### Testing
- [ ] 30+ прогонов критических сценариев
- [ ] Ручная матрица тестов (loading/error paths)
- [ ] Regression suite

### Documentation
- [ ] Архитектура, конфигурация секретов
- [ ] REST API docs
- [ ] Эксплуатация и масштабирование

### Admin UI Enhancement
- [ ] Operator action queue — фикс preview расхождения
- [ ] Отказоустойчивая админка (лимиты, деградация, очереди)

---

## 🗂️ Разделы отказоустойчивой админки (предложено)

| Раздел | Описание |
|--------|----------|
| Overview | KPI, incident snapshot, operator actions |
| Logs | Audit, filters, critical-only |
| Metrics | Success rate, health, COGS |
| System | Readiness, rollback, safe bench |
| Billing | Revenue, payments, subscriptions |
| API Keys | Keys management |
| Bot Control | Bot texts, broadcasts |
| Queue Control | Jobs, workers, retry |
| Provider Control | Proxy providers, health |
| Alerts | Уведомления, thresholds |
| Emergency | Safe stops, degradation modes |

---

## 📁 Файлы проекта

```
csbot/
├── server/          # Backend (Next.js API routes)
├── client/         # React admin UI
├── shared/         # Types, contracts
├── drizzle/        # DB migrations
├── scripts/        # Deploy, utils
├── tests/          # Vitest tests
├── todo.md         # Детальный TODO
├── AGENTS.md       # Агенты
├── CLAUDE.md       # Инструкции
├── ONE_CS_OPERATIONS_GUIDE.md
├── REMOTE_SERVER_DEPLOYMENT_GUIDE.md
├── domain_model_and_contracts.md
├── compatibility_matrix.md
├── regression_report.md
├── production_launch_report_2026-04-03.md
├── history/        # Истории чатов
└── ...
```

---

## 🚀 Запуск

```bash
cd csbot
pnpm install
pnpm db:push        # Apply migrations
pnpm dev            # Dev server

# Production
pnpm build
pm2 start dist/server/index.js
```