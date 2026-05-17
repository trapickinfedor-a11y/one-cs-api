# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CSBot Admin System is a full-stack TypeScript application built with tRPC + Express on the server and React on the client. It is an operator dashboard for a browser-automation / credit-score platform (ONE CS) that manages jobs, proxy infrastructure, workers, billing, and Telegram broadcasts. The system supports both a MySQL database (via Drizzle ORM) and a **mock fallback** that keeps everything in-memory when the database is unavailable — meaning it runs fully functional without any DB.

## Commands

```bash
# Development (starts server + Vite dev server)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Type check
pnpm check

# Run tests (vitest, environment=node)
pnpm test

# Run a single test file
pnpm vitest run server/auth.logout.test.ts

# Database push (generate + migrate via drizzle-kit)
pnpm db:push

# Format code
pnpm format
```

The dev server uses `tsx watch` and auto-finds an available port starting from 3000 if busy. The app entry point is `server/_core/index.ts` (not `server.ts` or `index.ts`).

## Architecture

### Server layer

- **`server/_core/index.ts`** is the Express app entry point. It registers:
  - Express-style REST auth routes (`/api/auth/login`, `/api/auth/change-password`, `/api/auth/me`) as plain handlers (not tRPC)
  - tRPC middleware via `createExpressMiddleware` at `/api/trpc`
  - REST API at `/api/v1/*` (see `restApi.ts`)
  - Vite dev server or static file serving based on `NODE_ENV`

- **`server/routers.ts`** wires the root `appRouter`. All tRPC procedures use `superjson` as the transformer. Auth is handled in context (`_core/context.ts`) by reading the `Authorization: Bearer <token>` header, verifying the JWT, and resolving the user from DB or runtimeStore.

- **`server/db.ts`** is the data access layer with a critical pattern: every function has a **mock fallback**. If `DATABASE_URL` is not set or the DB connection fails, it silently falls back to `runtimeStore.ts` (in-memory) or `platformMockData.ts`. This means the app is always functional without a database.

- **`server/runtimeStore.ts`** holds in-memory arrays as the fallback store. It implements the same interface as the DB layer. All IDs in the runtime store start at `1_000_000_000` to avoid collisions with DB-assigned IDs.

- **`server/platformService.ts`** contains all business logic: job creation (single/bulk/safe-test), API key management, broadcast campaigns via Telegram, bot text templates, operator logs, revenue analytics, and system readiness. It calls `db.ts` functions which handle the mock fallback automatically.

- **`server/restApi.ts`** is a separate Express router at `/api/v1/*` for external API consumers. It authenticates via Bearer token, enforces rate limits per API key scope, and calls `platformService.ts` functions. This is distinct from tRPC.

- **`server/platformMockData.ts`** provides hard-coded mock data (plans, proxy providers, workers, jobs, etc.) used when neither DB nor runtimeStore are available.

### Shared layer

- **`shared/platform.ts`** defines all Zod input schemas and type exports used by both server and client. Adding a new tRPC procedure? Define the schema here first.

- **`shared/oneCsScoring.ts`** is the credit scoring engine: maps raw credit scores to product scores (1-20) and data quality scores (1-10), normalizes adverse reasons into groups, and builds human-readable explanations.

- **`shared/importedLeadFormat.ts`** parses raw lead text input (multi-block format with names, addresses, phones, emails, DOB, SSN, credit score), computes completeness scores, and generates safe PII-redacted payloads for queue ingestion.

### Client layer

- **`client/src/main.tsx`** sets up the React Query + tRPC provider chain with `httpBatchLink`. Any tRPC error matching `UNAUTHED_ERR_MSG` redirects to `getLoginUrl()`.

- **`client/src/App.tsx`** uses `wouter` for routing. All admin pages are wrapped in `DashboardLayout` which checks authentication and shows a sign-in prompt if the user is not logged in.

- **`client/src/pages/Overview.tsx`** is the main dashboard. It loads data from 6 parallel tRPC queries (platform.overview, telemetry.summary, jobs.list, proxies.summary, workers.summary, billing.summary) and renders metric cards, health snapshots, operator action queues, and safe test scenarios.

- **`client/src/pages/Operations.tsx`** is a shared handler for 11 route paths (jobs, proxy, workers, billing, revenue, logs, log-chat, metrics, system, safe-bench, bot-texts, broadcasts). Each loads its own tRPC data.

- **`client/src/_core/hooks/useAuth.ts`** provides `user`, `loading`, `isAuthenticated`, `logout`, and `refresh`. It persists user info to localStorage and can redirect on unauthenticated access.

### Database

- **`drizzle/schema.ts`** defines 17 MySQL tables. Key tables: `jobs` (with indexes on status and queue+status), `apiKeys` (hashed, scoped), `workerNodes`, `proxyProviders`, `proxyPolicies`, `proxyLeases`, `auditTrail`, `systemSettings` (used for bot texts), `telegramEndpoints`.

- Drizzle migrations are tracked in `drizzle/meta/`. The migration journal shows a single entry: `0000_bouncy_drax`.

### Vite and build

- **`vite.config.ts`** configures path aliases `@` (client/src) and `@shared`. The manus-runtime plugin and a debug-collector plugin are included. The dev server allows hosts on `.manus*.computer` domains.

- Build output: `dist/` contains the server bundle; `dist/public/` contains the client build.

## Key Patterns

### Adding a new tRPC procedure

1. Add Zod input schema to `shared/platform.ts` (if needed)
2. Add business logic to `server/platformService.ts`
3. Wire it up in the appropriate sub-router in `server/routers.ts`
4. The client gets auto-completion via `client/src/lib/trpc.ts` which imports `AppRouter` type from `server/routers.ts`

### Mock fallback pattern

When writing a new DB query, follow the pattern in `db.ts`:
```ts
return withMockFallback("label", async db => { /* real query */ }, () => { /* fallback */ });
```

The runtime store in `runtimeStore.ts` must implement the same set of functions for the fallback to work.

### Auth flow

1. Login via `POST /api/auth/login` (Express handler, not tRPC)
2. Server returns a JWT cookie + Bearer token
3. tRPC context reads the `Authorization: Bearer <token>` header
4. Client stores user info in localStorage via `useAuth` hook

### Safe test mode

Jobs and broadcasts have a `safeTestMode` flag. When `true`, no external calls are made — everything runs against mock data or simulated in-memory state. This is the default for the operator test bench.

## Environment Variables

See `.env.example` for the full set. Critical vars:
- `DATABASE_URL` — MySQL connection string (optional; app works without it)
- `JWT_SECRET` — JWT signing secret
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` — initial admin credentials
- `PRIVATE_API_KEY` — for external REST API callers
- `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` — Manus Forge proxy for LLM, Maps, Storage, Image Gen
- `BOT_TOKEN` — Telegram bot token for broadcasts

## Testing

Tests are in `vitest` with `environment: node`. Mock data is provided by `platformMockData.ts`. Test files use `tsx` for execution. Run `pnpm test` or target individual files.
