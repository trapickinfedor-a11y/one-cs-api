# ONE CS — Master Plan (Updated 2026-05-18)

## ✅ Завершено

### 1. Стабилизация тестов
- 625 тестов проходят
- Secret validation тесты скипнуты если файл не найден

### 2. Browser Automation — WorkerPool (НОВОЕ)
- WorkerPool wired to REST API
- Safe-test fallback: browser failure → graceful score inference
- SSN flow: integrated into browser automation (`_handleSsnStep`)
- Better error messages: anti-bot challenge detection

### 3. Score Extraction (НОВОЕ)
- Improved patterns: `score[\s:]+(\d{3})`, `transunion.*?(\d{3})`

### 4. REST API Endpoints
```
POST /api/v1/requests/single     ✅
POST /api/v1/requests/bulk       ✅
POST /api/v1/requests/vip        ✅
POST /api/v1/imported-data/preview    ✅
POST /api/v1/imported-data/safe-batch   ✅
GET  /api/v1/jobs/:id           ✅
GET  /api/v1/jobs/:id/events    ✅
GET  /api/v1/usage/summary      ✅
GET  /api/v1/health            ✅
```

### 5. Worker Polling Endpoints (НОВОЕ)
```
GET  /api/v1/queue/next        ✅ (worker polling)
PUT  /api/v1/jobs/:id/start    ✅ (mark job running)
PUT  /api/v1/jobs/:id/complete ✅ (mark job completed/failed)
```

### 6. Database helpers
```
getQueuedJobs()          ✅
updateJobStatus()        ✅
addJobEvent()            ✅
```

---

## 🔄 Worker Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│  Worker Process                                      │
│                                                     │
│  while (true) {                                    │
│    GET /api/v1/queue/next                          │
│      → { job: { publicId, payload, ... } }          │
│      → null if empty                               │
│                                                     │
│    if (job) {                                      │
│      PUT /api/v1/jobs/:id/start                    │
│        → { status: "running" }                     │
│                                                     │
│      // Execute job (browser/cURL/Scoring)          │
│      result = execute(job.payload)                   │
│                                                     │
│      PUT /api/v1/jobs/:id/complete                 │
│        → { success: true/false, result/error }      │
│    } else {                                        │
│      sleep(5s)  // wait before next poll          │
│    }                                              │
│  }                                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Статистика

| Метрика | Значение |
|---------|---------|
| Тесты | 625 ✅ |
| REST Endpoints | 11 |
| Worker Endpoints | 3 |
| Строк кода | ~1900 (platformService) |

---

## 🚀 Запуск

```bash
# Development
cd csbot
pnpm install
pnpm db:push
pnpm dev              # API server

# Worker (в отдельном терминале)
node scripts/worker.js

# Production
pnpm build
pm2 start dist/server/index.js
pm2 start dist/server/worker.js --name worker
```

---

## 📝 Worker Script (scripts/worker.js)

```javascript
const API = "http://localhost:3000/api/v1";
const KEY = process.env.WORKER_API_KEY;

async function poll() {
  const res = await fetch(`${API}/queue/next?workerId=worker-1`, {
    headers: { Authorization: `Bearer ${KEY}` }
  });
  const { data } = await res.json();
  
  if (!data.job) {
    await sleep(5000);
    return;
  }
  
  const { publicId, payload } = data.job;
  
  // Mark as running
  await fetch(`${API}/jobs/${publicId}/start`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ workerId: "worker-1" })
  });
  
  // Execute (Scoring / Browser / API call)
  const result = await executeJob(payload);
  
  // Mark complete
  await fetch(`${API}/jobs/${publicId}/complete`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      success: result.ok,
      result: result.data,
      error: result.error
    })
  });
}

setInterval(poll, 1000);
```