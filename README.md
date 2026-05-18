# ONE CS API

Browser automation credit score platform. Real browser → universal-credit.com → credit score extraction.

## Quick Start

```bash
git clone https://github.com/trapickinfedor-a11y/one-cs-api.git
cd one-cs-api

pnpm install
pnpm dev
```

## Configuration

```bash
# .env (or environment variables)
PRIVATE_API_KEY=test123
EVOMI_USERNAME=trapickinf2
EVOMI_PASSWORD=32ODnutU9epdPIPxDRVU
EVOMI_HOST=core-residential.evomi.com
EVOMI_PORT=1000
BOT_TOKEN=your_telegram_bot_token
JWT_SECRET=your_jwt_secret_here
PORT=3000
```

## API Endpoints

```
POST /api/v1/requests/single     — single credit check
POST /api/v1/requests/bulk       — bulk credit checks
POST /api/v1/requests/vip       — VIP priority check
GET  /api/v1/jobs/:id           — job status
GET  /api/v1/jobs/:id/events    — job events
GET  /api/v1/usage/summary       — API usage
GET  /api/v1/health             — health check
GET  /api/v1/queue/next         — worker polling
PUT  /api/v1/jobs/:id/start     — worker: mark running
PUT  /api/v1/jobs/:id/complete  — worker: mark done
```

## Architecture

```
Client → REST API → platformService → WorkerPool (Chromium + Evomi Proxy)
                                              ↓
                                      3-step form fill
                                      universal-credit.com/funnel
                                              ↓
                                      Score extraction 300-850
                                              ↓
                                      Job result + notifications
```

## Browser Automation

- **Playwright** chromium browser with Evomi residential proxies
- **Fingerprint rotation** per session (resolution, timezone, language, canvas)
- **Human behavior simulation** (typing delays, mouse movements, scroll)
- **SSN flow** support for verification-required requests
- **Fallback** to safe-test mode if Evomi credentials missing

## Scripts

```bash
pnpm dev         # Development server (localhost:3000)
pnpm build       # Production build
pnpm worker      # Standalone worker (external deployment)
pnpm test        # Run all tests (696+ tests)
pnpm check       # TypeScript check
```

## Tests

```
696 passed | 4 skipped | 29 test files
- Unit tests (platformService, scoring, db, workers)
- Integration tests (WorkerPool, SSN flow, FingerprintRotator)
- E2E Playwright tests (funnel, form filling, score extraction)
- Comprehensive browser automation suite (71 tests)
```

## License

MIT