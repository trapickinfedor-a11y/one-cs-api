# ONE CS API — Browser Automation Credit Score Platform

**Version**: 1.0 | **License**: MIT

ONE CS API is a headless browser automation platform that retrieves real US credit scores (300–850) by filling multi-step forms on [universal-credit.com](https://www.universal-credit.com) using Playwright + rotating residential proxies, then extracting the score from the Adverse Action Notice PDF.

The result is wrapped in a structured `OneCsResult` with `creditScore`, `productScore`, `dataQualityScore`, `status`, and `adverseReasons`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                         │
│        (REST API · Telegram Bot · Dashboard · External Integrations)│
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Bearer token (PRIVATE_API_KEY or API key)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        REST API  (:3000)                           │
│  POST /requests/single   POST /requests/bulk   POST /requests/vip   │
│  GET  /jobs/:id          GET  /jobs/:id/events                      │
│  GET  /usage/summary     GET  /health                               │
│  PUT  /jobs/:id/start    PUT  /jobs/:id/complete                    │
└────┬────────────────┬────────────────┬──────────────────────────────┘
     │                │                │
     ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌─────────────────┐
│ Platform │  │ WorkerPool  │  │  Telegram Bot    │
│ Service  │  │  (in-process│  │  Webhook Handler │
│  (jobs,  │  │  browsers)  │  │                  │
│  storage)│  └──────┬───────┘  └──────────────────┘
└────┬─────┘         │
     │               ▼
     │        ┌──────────────────┐
     │        │   Proxy Manager  │
     │        │ (Evomi → DataImpulse fallback)
     │        └────────┬─────────┘
     │                 │
     │        ┌────────▼──────────┐
     │        │    BrowserPool   │  FingerprintRotator
     │        │ (Playwright/Chromium) │ (canvas, timezone,
     │        └────────┬──────────┘  lang, resolution)
     │                 │
     └────────────►    ▼
              ┌────────────────────────────┐
              │   universal-credit.com     │
              │   /funnel/ form funnel     │
              │   Step 1: Contact info     │
              │   Step 2: Personal info    │
              │   Step 3: Financial info  │
              │          ↓                 │
              │   Adverse Action Notice PDF│
              │   (score extraction)       │
              └────────────────────────────┘

Graceful degradation chain:
  Browser mode → safe_test fallback (guaranteed response)
  Evomi proxy → DataImpulse fallback → direct connection
  Score extraction fail → safe_test fallback
  Anti-bot challenge → circuit breaker → safe_test fallback
```

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/trapickinfedor-a11y/one-cs-api.git
cd one-cs-api
pnpm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
# ── API Authentication ────────────────────────────────────────────────
PRIVATE_API_KEY=test123

# ── Proxy (Evomi — residential rotating proxies) ─────────────────────
EVOMI_USERNAME=trapickinf2
EVOMI_PASSWORD=32ODnutU9epdPIPxDRVU
EVOMI_HOST=core-residential.evomi.com
EVOMI_PORT=1000

# ── Fallback proxy (DataImpulse) ──────────────────────────────────────
# Used automatically if Evomi is unavailable
DATAIMPULSE_API_KEY=
DATAIMPULSE_USERNAME=
DATAIMPULSE_PASSWORD=

# ── Telegram Bot ───────────────────────────────────────────────────────
BOT_TOKEN=your_telegram_bot_token_here

# ── JWT / Session ─────────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_here

# ── Server ────────────────────────────────────────────────────────────
PORT=3000
```

> **Note**: If `EVOMI_USERNAME` is not set, the system runs in `safe_test` mode — all jobs use deterministic test data instead of real browser automation. This is useful for development and testing.

### 3. Start the server

```bash
pnpm dev          # Development (http://localhost:3000)
pnpm build && node dist/server/_core/index.js  # Production
```

### 4. Start a standalone worker (optional — for external deployment)

```bash
pnpm worker
```

### 5. Make your first API call

```bash
curl -X POST http://localhost:3000/api/v1/requests/single \
  -H "Authorization: Bearer test123" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "street": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "dob": "01/15/1985",
    "annualIncome": "65000",
    "email": "john.doe@example.com",
    "phone": "5125551234"
  }'
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PRIVATE_API_KEY` | Yes | — | Legacy bearer token for all API endpoints. Equivalent to an admin API key. |
| `EVOMI_USERNAME` | No | — | Evomi proxy username. When absent, system enters `safe_test` mode. |
| `EVOMI_PASSWORD` | No | — | Evomi proxy password. |
| `EVOMI_HOST` | No | `core-residential.evomi.com` | Evomi proxy host. |
| `EVOMI_PORT` | No | `1000` | Evomi proxy port. |
| `DATAIMPULSE_API_KEY` | No | — | DataImpulse API key (fallback proxy provider). |
| `DATAIMPULSE_USERNAME` | No | — | DataImpulse username. |
| `DATAIMPULSE_PASSWORD` | No | — | DataImpulse password. |
| `BOT_TOKEN` | No | — | Telegram bot token for notifications. |
| `JWT_SECRET` | No | — | Secret for JWT session tokens. |
| `PORT` | No | `3000` | HTTP server port. |
| `ROTATE_AFTER_N_SUCCESS` | No | `20` | Rotate Evomi proxy after N successful jobs. |
| `ROTATE_ON_ERROR_COUNT` | No | `2` | Rotate Evomi proxy after N consecutive errors. |

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Authentication

All endpoints (except `/health`) require a `Bearer` token in the `Authorization` header.

**Legacy API key:**
```
Authorization: Bearer test123
```

**Modern API keys** (stored in the database):
```
Authorization: Bearer cs_vip_xxxx  # VIP scope
Authorization: Bearer cs_bulk_xxxx # Bulk scope
Authorization: Bearer cs_admin_xxxx # Admin scope
Authorization: Bearer cs_single_xxxx # Single scope
```

### Rate Limits

| Scope | Requests/minute | Daily limit |
|---|---|---|
| `single` | 60 | 1,000 |
| `bulk` | 120 | 10,000 |
| `vip` | 300 | 50,000 |
| `admin` | Unlimited | Unlimited |

---

### `POST /requests/single`

Submit one credit check request.

**Auth**: `single`, `bulk`, `vip`, `admin` scope.

**Request body** — `CreateJobInput`:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "street": "123 Main St",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "dob": "01/15/1985",
  "annualIncome": "65000",
  "email": "john.doe@example.com",
  "phone": "15125551234",
  "ssn": "123456789",
  "telegramChatId": "123456789"
}
```

**Response** — `ApiEnvelope<CreateJobResult>`:
```json
{
  "success": true,
  "requestId": "req_1718123456_abc123",
  "data": {
    "jobId": "job_a3f9c2",
    "publicId": "cs_1a2b3c",
    "status": "queued",
    "estimatedWaitSeconds": 5,
    "priority": 1,
    "queuePosition": 3
  }
}
```

---

### `POST /requests/bulk`

Submit multiple credit check requests in a single call.

**Auth**: `bulk`, `vip`, `admin` scope.

**Request body** — `CreateBulkJobInput`:
```json
{
  "requests": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "street": "123 Main St",
      "city": "Austin",
      "state": "TX",
      "zipCode": "78701",
      "dob": "01/15/1985",
      "annualIncome": "65000"
    },
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "street": "456 Oak Ave",
      "city": "Denver",
      "state": "CO",
      "zipCode": "80202",
      "dob": "03/22/1990",
      "annualIncome": "85000"
    }
  ]
}
```

**Response** — `ApiEnvelope<CreateBulkJobResult>`:
```json
{
  "success": true,
  "requestId": "req_1718123457_def456",
  "data": {
    "batchId": "batch_x9y2z1",
    "totalRequested": 2,
    "totalCreated": 2,
    "jobs": [
      { "jobId": "job_a3f9c3", "publicId": "cs_4d5e6f", "status": "queued" },
      { "jobId": "job_a3f9c4", "publicId": "cs_7g8h9i", "status": "queued" }
    ]
  }
}
```

---

### `POST /requests/vip`

Submit a VIP priority credit check. Skips the standard queue and processes immediately with dedicated resources.

**Auth**: `vip`, `admin` scope.

**Request body** — same as `POST /requests/single` (extra `vip: true` flag set automatically).

**Response** — same as `POST /requests/single`, with `meta.vip: true`.

---

### `GET /jobs/:publicId`

Get the status and result of a specific job.

**Auth**: Any scope.

**Response** — `ApiEnvelope<JobDetail>`:
```json
{
  "success": true,
  "requestId": "req_1718123458_ghi789",
  "data": {
    "publicId": "cs_1a2b3c",
    "status": "succeeded",
    "requestMode": "single",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "completedAt": "2025-01-15T10:31:45.000Z",
    "result": {
      "creditScore": 723,
      "productScore": 14.5,
      "dataQualityScore": 8.2,
      "status": "review",
      "adverseReasons": ["high_utilization", "recent_inquiry"],
      "priceUsd": 3.50,
      "source": "browser"
    }
  },
  "meta": {
    "eventCount": 7
  }
}
```

**`status` field values**:
- `queued` — waiting in queue
- `running` — worker is processing
- `succeeded` — completed with a result
- `failed` — worker error (safe-test fallback used)
- `canceled` — manually cancelled
- `waiting_retry` — retry scheduled

---

### `GET /jobs/:publicId/events`

Get all events for a job (audit trail of all state transitions).

**Auth**: Any scope.

**Response** — `ApiEnvelope<JobEvent[]>`:
```json
{
  "success": true,
  "requestId": "req_1718123459_jkl012",
  "data": [
    { "eventType": "job.created", "severity": "info", "message": "Job queued", "createdAt": "2025-01-15T10:30:00.000Z" },
    { "eventType": "worker.started", "severity": "info", "message": "Worker pool-3 picked up job", "eventJson": { "workerId": 3 }, "createdAt": "2025-01-15T10:30:05.000Z" },
    { "eventType": "job.completed", "severity": "info", "message": "Job completed successfully", "eventJson": { "creditScore": 723, "source": "browser" }, "createdAt": "2025-01-15T10:31:45.000Z" }
  ],
  "meta": { "publicId": "cs_1a2b3c" }
}
```

---

### `GET /queue/next`

Worker polling endpoint. Returns the next job in the queue for processing.

**Auth**: Any scope.

**Query parameters**:
| Parameter | Type | Default | Description |
|---|---|---|---|
| `workerId` | string | `worker-1` | Identifier for the polling worker |

**Response (job available)**:
```json
{
  "success": true,
  "requestId": "req_1718123460_mno345",
  "data": {
    "job": {
      "publicId": "cs_1a2b3c",
      "requestMode": "single",
      "payload": { "firstName": "John", "lastName": "Doe", ... },
      "queueName": "default",
      "priority": 1,
      "workerId": "pool-3"
    }
  }
}
```

**Response (queue empty)**:
```json
{
  "success": true,
  "requestId": "req_1718123460_mno345",
  "data": {
    "job": null,
    "message": "No jobs in queue"
  }
}
```

---

### `PUT /jobs/:publicId/start`

Mark a job as `running`. Called by a worker when it picks up a job.

**Auth**: Any scope.

**Request body**:
```json
{ "workerId": "pool-3" }
```

**Response** — `ApiEnvelope<{ status: "running", publicId: string }>`:
```json
{
  "success": true,
  "requestId": "req_1718123461_pqr678",
  "data": { "status": "running", "publicId": "cs_1a2b3c" }
}
```

---

### `PUT /jobs/:publicId/complete`

Mark a job as completed or failed. Called by a worker after processing.

**Auth**: Any scope.

**Request body (success)**:
```json
{
  "success": true,
  "result": {
    "creditScore": 723,
    "productScore": 14.5,
    "dataQualityScore": 8.2,
    "status": "review",
    "adverseReasons": ["high_utilization"],
    "priceUsd": 3.50,
    "source": "browser"
  }
}
```

**Request body (failure)**:
```json
{
  "success": false,
  "error": "Browser crashed: net::ERR_CONNECTION_RESET"
}
```

**Response** — `ApiEnvelope<{ status: "succeeded" | "failed", publicId: string }>`:
```json
{
  "success": true,
  "requestId": "req_1718123462_stu901",
  "data": { "status": "succeeded", "publicId": "cs_1a2b3c" }
}
```

---

### `GET /usage/summary`

Get API usage statistics for the authenticated key.

**Auth**: Any scope.

**Response** — `ApiEnvelope<ApiUsageSummary>`:
```json
{
  "success": true,
  "requestId": "req_1718123463_vwx234",
  "data": {
    "today": { "hits": 142, "limit": 1000 },
    "thisMonth": { "hits": 4820, "limit": 30000 },
    "rpm": { "hits": 12, "limit": 60 }
  }
}
```

---

### `GET /health`

Public health check. No authentication required.

**Response** — `ApiEnvelope<SystemHealth, { public: true }>`:
```json
{
  "success": true,
  "requestId": "req_1718123464_yza567",
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "version": "1.0.0",
    "workers": { "total": 3, "busy": 1, "idle": 2 },
    "proxy": { "provider": "evomi", "status": "healthy" },
    "queue": { "pending": 5, "running": 1 }
  },
  "meta": { "public": true }
}
```

---

## Payload Schema

All job creation endpoints accept the following fields:

### Required fields

| Field | Type | Format | Description |
|---|---|---|---|
| `firstName` | string | — | Applicant's first name |
| `lastName` | string | — | Applicant's last name |
| `street` | string | — | Street address |
| `city` | string | — | City |
| `state` | string | 2-letter US state code (e.g., TX, CA) | State |
| `zipCode` | string | 5-digit or `XXXXX-XXXX` | ZIP code |
| `dob` | string | `MM/DD/YYYY` | Date of birth |
| `annualIncome` | string | Integer (e.g., `"65000"`) | Annual income in USD |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `email` | string | Contact email address |
| `phone` | string | Contact phone number (any format) |
| `ssn` | string | Social Security Number (9 digits). Required for verification on some requests; triggers the SSN flow. |
| `telegramChatId` | string | Telegram chat ID for job status notifications |

---

## Response Schema

Every API response follows this envelope format:

```json
{
  "success": true,
  "requestId": "req_1718123456_abc123",
  "data": { ... },
  "meta": { ... }
}
```

### `OneCsResult` — the actual scoring result

The `result` object inside a succeeded job contains:

| Field | Type | Range | Description |
|---|---|---|---|
| `creditScore` | number \| null | 300–850 | Real FICO-equivalent score, or `null` if not extracted |
| `productScore` | number \| null | 1–20 | Normalized product quality score |
| `dataQualityScore` | number \| null | 1–10 | Score quality signal (higher = more reliable) |
| `status` | string | see below | Overall recommendation |
| `adverseReasons` | string[] | — | Normalized reason groups affecting the score |
| `priceUsd` | number | — | Estimated cost in USD |
| `source` | string | `browser` \| `safe_test` | Whether the score came from a real browser or safe-test |

### Status values

| Status | Description |
|---|---|
| `success` | Score retrieved reliably; no adverse signals |
| `review` | Score retrieved but some adverse factors present |
| `decline` | Score retrieved with significant adverse factors |
| `no_file` | No credit file found for this person |
| `error` | Safe-test fallback; browser automation failed |

### Adverse reason groups

The system normalizes raw adverse reasons into groups:
- `late_payments` — payment history issues
- `high_utilization` — high credit utilization
- `recent_inquiry` — hard inquiries within 12 months
- `collection` — accounts in collections
- `bankruptcy` — bankruptcy filings
- `derogatory` — other derogatory marks
- `thin_file` — insufficient credit history
- `no_negative` — no adverse factors found

---

## Telegram Bot Commands

The platform includes a Telegram bot integration for receiving and monitoring jobs via chat.

| Command | Description |
|---|---|
| `/start` | Welcome message with instructions |
| `/help` | Full help text and command list |
| `/status <job_id>` | Check the status of a specific job |

### Natural language input

The bot also accepts natural text in any format. It parses the text to extract:
- Name (first + last)
- Address components
- Date of birth
- Annual income
- Email
- Phone number

Any `ssn` detected in the message immediately re-prompts for SSN input (for security).

### SSN flow

If a job requires SSN verification, the bot prompts the user to enter their SSN. The user can reply with just the 9-digit SSN, and the job resumes.

---

## Worker Pool Architecture

The WorkerPool manages concurrent credit check jobs using in-process Playwright Chromium instances.

### Browser Pool

- Each worker holds a dedicated `BrowserPool` (Chromium instance)
- Browsers are reused across jobs when possible
- `browserPool.newContext()` creates an isolated browser context per job
- Contexts include fresh fingerprints and proxy sessions

### Fingerprint Rotation

`FingerprintRotator` assigns a unique browser fingerprint per session:

- **Resolution**: Random from common desktop sizes (1280×800, 1366×768, 1440×900, etc.)
- **Timezone**: Matches the proxy exit location
- **Language**: `en-US` with `Accept-Language` headers
- **Canvas**: Random noise injected into the canvas fingerprint
- **WebGL vendor/renderer**: Varies per session

### Proxy Rotation

`ProxyManager` handles proxy lifecycle:

```
Acquire: Evomi (HTTP CONNECT) → DataImpulse (REST API) → direct fallback
Rotate:  Every 20 successes OR after 2 consecutive errors (configurable)
Release: After job completes, returned to pool
Circuit breaker: After 5 errors, proxy provider is skipped for 60s
```

**Proxy hierarchy**:
1. Evomi residential (preferred, HTTP CONNECT on port 1000)
2. DataImpulse (fallback, REST API session creation)
3. Direct connection (last resort)

### SSN Flow Manager

When a job requires SSN verification:
1. Worker fills the 3-step form up to the SSN gate
2. `SSNFlowManager` intercepts the challenge
3. System sends the SSN via the Telegram bot prompt (or receives it via API)
4. Resumes the form with the provided SSN
5. Completes the funnel and extracts the score

### Circuit Breaker

`CreditScoreWorker` implements a circuit breaker:
- **Threshold**: 3 consecutive anti-bot failures
- **Reset**: After 120 seconds of cool-off
- **Action**: Opens circuit → safe-test fallback for all jobs until reset

Anti-bot failure types:
- Captcha challenges
- Cloudflare detection
- Invisible elements / blocked fields
- `429 Too Many Requests` rate limits

### Retry Logic

Each job supports up to 3 retries with exponential backoff:
- Attempt 1: immediate
- Attempt 2: 1 second backoff
- Attempt 3: 5 seconds backoff
- After 3 failures: safe-test fallback

---

## Reliability Guarantees

ONE CS API is designed for **zero-dropout** — every submitted job produces a response, even when all automation infrastructure fails.

### Fallback Chain

```
1. Browser automation (Playwright + Evomi)
   ↓ [proxy failure, browser crash, network error]
2. Retry with new proxy rotation (up to 3 attempts)
   ↓ [anti-bot circuit open, timeout exhausted]
3. DataImpulse fallback proxy
   ↓ [DataImpulse unavailable]
4. Direct connection (no proxy)
   ↓ [connection fails]
5. safe_test fallback — deterministic score from payload data
```

### What each failure mode produces

| Failure mode | Behavior | Response |
|---|---|---|
| Browser crashes mid-session | Job marked failed → safe-test fallback | `creditScore` computed from payload; `source: "safe_test"`, `status: "error"` |
| Proxy connection timeout | Rotate proxy → retry | Same as above after all retries exhausted |
| Anti-bot challenge detected | Circuit breaker open → all jobs safe-test | Deterministic score; circuit resets after 120s |
| Score not found in PDF | Fallback to raw byte decode | Same score extraction path; safe-test as last resort |
| Evomi credentials invalid | Safe-test mode auto-enabled | Deterministic test score for all jobs |
| Telegram notification fails | Non-blocking; job continues | Job completes normally; notification silently skipped |

### Guaranteed response guarantee

Because the safe-test fallback is deterministic based on the payload, every job produces a response. The `status` field distinguishes real scores (`source: "browser"`) from test-mode scores (`source: "safe_test"`).

---

## Error Codes

| Code | HTTP | Description | Fix |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | Invalid request payload | Check field formats (see payload schema) |
| `UNAUTHORIZED` | 401 | Missing or invalid API key | Provide valid Bearer token |
| `FORBIDDEN` | 403 | API key scope too limited | Use key with required scope (single/bulk/vip/admin) |
| `NOT_FOUND` | 404 | Job or resource not found | Check the publicId format (cs_xxxxx) |
| `RATE_LIMITED` | 429 | Rate limit exceeded | Wait and retry, or upgrade to higher scope |
| `QUEUE_FULL` | 503 | Worker queue at capacity | Retry after a short delay |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Contact administrator |

---

## Reliability Guarantees

The system is designed with multiple layers of fallback to ensure every job returns a result.

### Fallback Chain

```
├─ Browser automation (Playwright + Evomi proxy)
│   └─ Score extracted from Adverse Action Notice PDF
│       └─ If PDF download fails → parse page text directly
│           └─ If text parsing fails → safe_test fallback
│
├─ Proxy rotation
│   └─ Evomi residential → DataImpulse fallback → direct connection
│
├─ Anti-bot handling
│   └─ Fingerprint rotation per attempt
│       └─ Circuit breaker (3 failures → 2 min pause)
│           └─ Safe test fallback
│
└─ Error retry
    └─ TRANSIENT (timeout/net) → retry 1-2x with backoff 1s→5s→15s
        └─ ANTIBOT (challenge/captcha) → retry with new fingerprint
            └─ PERMANENT → instant safe test fallback
```

### Score Guarantee

**Every job returns a score 300-850.** The only question is whether it's a real score from browser automation or a deterministic fallback from safe_test mode.

|Scenario|Result|
|---|---|
|UC form fills → result page loads → score extracted|Real score 300-850|
|Browser crash/timeout|Safe test score 450-849|
|Anti-bot challenge blocks form|Safe test score 450-849|
|Proxy fails|Retry → DataImpulse fallback → safe test if needed|
|Safe test mode (no Evomi credentials)|Deterministic score 450-849|

### Performance

- Typical real browser job: 30-90 seconds (browser automation + PDF download + score extraction)
- Safe test fallback: < 1 second (deterministic hash-based score)
- Max retries: 3 per job (1s, 5s, 15s backoff between attempts)
- Circuit breaker: 120 seconds cooldown after 3 consecutive anti-bot failures

### SSN Handling

Jobs that require SSN verification return `needsSsn: true`. The workflow:
1. User provides SSN via Telegram bot or API
2. SSN is injected into the form at the appropriate step
3. Job resumes with SSN context

### Telegram Bot

Commands:
- `/start` — welcome message
- `/help` — help message
- `/status <job_id>` — job status lookup
- `/cancel` — cancel pending flow
- Free text — parse and create job
- SSN (XXX-XX-XXXX) — resume pending job

Languages: English, Russian (auto-detected from user locale)

### Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- src/specific.test.ts

# Run with coverage
pnpm test -- --coverage

# Type check
pnpm check

# Build
pnpm build
```


### Health Check

`GET /api/v1/health` returns:
- `status: "ok"` — server is healthy
- `workers: { active: N, queued: M }` — worker pool status
- `evomi: { status: "connected" | "disconnected" }` — proxy provider status

### Troubleshooting


|Symptom|Cause|Fix|
|---|---|
|`status: failed` every job|Evomi credentials invalid or network blocked|Check EVOMI_USERNAME/PASSWORD, verify network access to core-residential.evomi.com:1000|
|Random scores 450-849|System in safe_test mode (no Evomi)|Set EVOMI_USERNAME and EVOMI_PASSWORD|
|Anti-bot circuit open|UC blocking your proxy IPs|Wait 120 seconds, or rotate to new proxy IPs|
|Browser timeout|UC pages slow or network lag|Normal — system retries with backoff|
|"Invalid SSN format"|SSN not in XXX-XX-XXXX|Format SSN correctly|
|All scores very low (300-400)|Possible form submission issue|Check network/proxy; fallback used|

---

## Architecture Deep Dive

**Browser automation flow:**
1. Acquire residential proxy (Evomi → DataImpulse fallback)
2. Generate browser fingerprint (canvas, timezone, language, resolution)
3. Inject anti-fingerprint noise
4. Navigate to universal-credit.com funnel
5. Fill Step 1 (Personal info): name, address, DOB
6. Fill Step 2 (Income): annual income
7. Wait for SSN step if required
8. Navigate to Documents portal
9. Find and download Adverse Action Notice PDF
10. Extract credit score from PDF using PDF.js
11. If PDF fails → parse page text directly
12. If text fails → return safe_test fallback

**Proxy rotation:**
- Evomi: `trapickinf2` / `core-residential.evomi.com:1000`
- Rotate after 20 successful jobs OR 2 consecutive errors
- Fallback: DataImpulse (if configured)
- Last resort: direct connection

---


## Performance Tuning


| Variable | Default | Effect |
|---|---|
| `ROTATE_AFTER_N_SUCCESS` | 20 | Rotate proxy every N jobs |
| `ROTATE_ON_ERROR_COUNT` | 2 | Rotate proxy after N errors |
| `MAX_CONCURRENCY` | 3 | Max parallel browser jobs |
| `BROWSER_TIMEOUT_MS` | 90000 | Browser job timeout (90s) |

---

## OpenAPI Specification

The API follows OpenAPI 3.0 conventions. See the full spec at `/api/v1/openapi.json` when the server is running.

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Write tests for new functionality
4. Ensure `pnpm test` passes
5. Ensure `pnpm check` passes (0 TypeScript errors)
6. Submit PR

---

## License


MIT — See LICENSE file
