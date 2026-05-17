import express from "express";
import {
  createBulkJobSchema,
  createJobSchema,
} from "../shared/platform";
import { createHash } from "node:crypto";
import {
  buildApiError,
  buildApiResponse,
  createBulkJob,
  createSafeImportedLeadBatch,
  createSingleJob,
  deriveRateLimit,
  getApiUsageSummary,
  getJobDetails,
  getSystemModule,
  previewImportedLeadText,
} from "./platformService";
import { findApiKeyAuthRecordByHash, incrementDailyHits, incrementRateLimitHits, touchApiKeyLastUsed, updateJobStatus, persistJobEvents, getQueuedJobs } from "./db";

type ApiClient = {
  token: string;
  apiKeyId: number | null;
  keyPrefix: string;
  scope: "single" | "bulk" | "vip" | "admin";
  userId: number | null;
  rpmLimit?: number;
  dailyLimit?: number;
  authSource: "api_key" | "legacy_private_key";
};

function parseImportedTextBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const inputText = (body as { inputText?: unknown }).inputText;
  if (typeof inputText !== "string") return null;
  const trimmed = inputText.trim();
  if (!trimmed || trimmed.length > 200000) return null;
  return { inputText: trimmed };
}

function getRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getMinuteKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
}

function parseScopeFromToken(token: string): ApiClient["scope"] {
  if (token.startsWith("cs_vip_") || token.startsWith("vip_")) return "vip";
  if (token.startsWith("cs_admin_") || token.startsWith("admin_")) return "admin";
  if (token.startsWith("cs_bulk_") || token.startsWith("bulk_")) return "bulk";
  return "single";
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

async function authenticateRequest(req: express.Request): Promise<ApiClient | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  if (process.env.PRIVATE_API_KEY && token === process.env.PRIVATE_API_KEY) {
    return {
      token,
      apiKeyId: null,
      keyPrefix: token.slice(0, 16),
      scope: "admin",
      userId: 1,
      authSource: "legacy_private_key",
    };
  }

  const record = await findApiKeyAuthRecordByHash(hashToken(token));
  if (!record) {
    return null;
  }

  if (record.status !== "active") {
    return null;
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await touchApiKeyLastUsed(record.id, new Date());

  return {
    token,
    apiKeyId: record.id,
    keyPrefix: record.keyPrefix,
    scope: record.scope as ApiClient["scope"],
    userId: record.userId,
    rpmLimit: record.rpmLimit,
    dailyLimit: record.dailyLimit,
    authSource: "api_key",
  };
}

async function applyRateLimit(client: ApiClient) {
  const derived = deriveRateLimit(client.scope);
  const limit = {
    rpm: client.rpmLimit ?? derived.rpm,
    daily: client.dailyLimit ?? derived.daily,
  };

  const minuteHits = await incrementRateLimitHits(client.keyPrefix, "minute");
  const dailyHits = await incrementDailyHits(client.keyPrefix);

  if (minuteHits > limit.rpm) {
    return { allowed: false, limit, current: minuteHits, dailyHits };
  }

  return { allowed: true, limit, current: minuteHits, dailyHits };
}

function sendValidationError(res: express.Response, requestId: string, message: string, details?: Record<string, unknown>) {
  return res.status(400).json(buildApiError(requestId, "VALIDATION_ERROR", message, false, details));
}

function sendUnauthorized(res: express.Response, requestId: string) {
  return res.status(401).json(buildApiError(requestId, "UNAUTHORIZED", "Bearer token is required.", false));
}

function sendForbidden(res: express.Response, requestId: string, message: string) {
  return res.status(403).json(buildApiError(requestId, "FORBIDDEN", message, false));
}

function sendRateLimit(res: express.Response, requestId: string, meta: Record<string, unknown>) {
  return res.status(429).json(buildApiError(requestId, "RATE_LIMITED", "Rate limit exceeded for this API key.", true, meta));
}

export function registerRestApi(app: express.Express) {
  const router = express.Router();

  // Public health endpoint
  router.get("/health", async (_req, res) => {
    const requestId = getRequestId();
    const system = await getSystemModule();
    return res.json(buildApiResponse(requestId, system.health, { public: true }));
  });

  // Auth middleware for all other routes
  router.use(async (req, res, next) => {
    const requestId = getRequestId();
    res.locals.requestId = requestId;

    const client = await authenticateRequest(req);
    if (!client) {
      return sendUnauthorized(res, requestId);
    }

    const rate = await applyRateLimit(client);
    if (!rate.allowed) {
      return sendRateLimit(res, requestId, {
        rpm: rate.limit.rpm,
        currentHits: rate.current,
      });
    }

    res.locals.apiClient = client;
    res.locals.rateLimit = rate.limit;
    next();
  });

  // ─── Job creation endpoints ───────────────────────────────────────────────

  router.post("/requests/single", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid single request payload.", {
        issues: parsed.error.flatten(),
      });
    }

    const client = res.locals.apiClient as ApiClient;
    if (client.scope === "single" || client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createSingleJob(parsed.data, { userId: client.userId ?? undefined, source: "api" });
      return res.json({ ...result, requestId });
    }

    return sendForbidden(res, requestId, "API key scope does not allow single requests.");
  });

  router.post("/requests/bulk", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const parsed = createBulkJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid bulk request payload.", {
        issues: parsed.error.flatten(),
      });
    }

    const client = res.locals.apiClient as ApiClient;
    if (client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createBulkJob(parsed.data, { userId: client.userId ?? undefined, source: "api" });
      return res.json({ ...result, requestId });
    }

    return sendForbidden(res, requestId, "API key scope does not allow bulk requests.");
  });

  router.post("/requests/vip", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const parsed = createJobSchema.safeParse({ ...req.body, requestMode: "vip" });
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid VIP request payload.", {
        issues: parsed.error.flatten(),
      });
    }

    const client = res.locals.apiClient as ApiClient;
    if (client.scope === "vip" || client.scope === "admin") {
      const result = await createSingleJob(parsed.data, { userId: client.userId ?? undefined, source: "api" });
      return res.json({ ...result, requestId, meta: { ...result.meta, vip: true } });
    }

    return sendForbidden(res, requestId, "VIP scope is required for this endpoint.");
  });

  // ─── Imported data endpoints ────────────────────────────────────────────

  router.post("/imported-data/preview", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const parsed = parseImportedTextBody(req.body);
    if (!parsed) {
      return sendValidationError(res, requestId, "Invalid imported data payload.", {
        expected: { inputText: "non-empty string up to 200000 chars" },
      });
    }

    const result = await previewImportedLeadText(parsed.inputText);
    return res.json(buildApiResponse(requestId, result, { piiRedacted: true, safePreview: true }));
  });

  router.post("/imported-data/safe-batch", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const parsed = parseImportedTextBody(req.body);
    if (!parsed) {
      return sendValidationError(res, requestId, "Invalid imported data payload.", {
        expected: { inputText: "non-empty string up to 200000 chars" },
      });
    }

    const client = res.locals.apiClient as ApiClient;
    if (client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createSafeImportedLeadBatch(parsed.inputText, {
        userId: client.userId ?? undefined,
        source: "api",
      });
      return res.json({ ...result, requestId, meta: { ...result.meta, piiRedacted: true, importedFormat: true } });
    }

    return sendForbidden(res, requestId, "Bulk, VIP or admin scope is required for safe imported batches.");
  });

  // ─── Job status endpoints ────────────────────────────────────────────────

  router.get("/jobs/:publicId", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const details = await getJobDetails(req.params.publicId);

    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found.", false));
    }

    return res.json(buildApiResponse(requestId, details.job, { eventCount: details.events.length }));
  });

  router.get("/jobs/:publicId/events", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const details = await getJobDetails(req.params.publicId);

    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found.", false));
    }

    return res.json(buildApiResponse(requestId, details.events, { publicId: details.job.publicId }));
  });

  // ─── Worker polling endpoints ───────────────────────────────────────────

  // GET /api/v1/queue/next — worker polls for next queued job
  router.get("/queue/next", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const workerId = (req.query.workerId as string) || "worker-1";
    
    const jobs = await getQueuedJobs(1);
    
    if (!jobs.length) {
      return res.json(buildApiResponse(requestId, { job: null, message: "No jobs in queue" }));
    }
    
    const job = jobs[0];
    return res.json(buildApiResponse(requestId, {
      job: {
        publicId: job.publicId,
        requestMode: job.requestMode,
        payload: job.payloadJson,
        queueName: job.queueName,
        priority: job.priority,
        workerId,
      }
    }));
  });

  // PUT /api/v1/jobs/:publicId/start — mark job as running
  router.put("/jobs/:publicId/start", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const { publicId } = req.params;
    const workerId = (req.body.workerId as string) || "worker-1";

    const details = await getJobDetails(publicId);
    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found", false));
    }

    await updateJobStatus(publicId, "running");
    await persistJobEvents([{
      jobId: details.job.id,
      eventType: "worker.started",
      severity: "info",
      message: `Worker ${workerId} picked up job ${publicId}`,
      eventJson: { workerId },
      createdAt: new Date(),
    }]);

    return res.json(buildApiResponse(requestId, { status: "running", publicId }));
  });

  // PUT /api/v1/jobs/:publicId/complete — mark job as completed/failed
  router.put("/jobs/:publicId/complete", async (req, res) => {
    const requestId = res.locals.requestId as string;
    const { publicId } = req.params;
    const { success, result, error } = req.body as {
      success: boolean;
      result?: Record<string, unknown>;
      error?: string;
    };

    const details = await getJobDetails(publicId);
    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found", false));
    }

    const completedAt = new Date();
    if (success) {
      await updateJobStatus(publicId, "succeeded", { resultJson: result ?? {}, completedAt });
      await persistJobEvents([{
        jobId: details.job.id,
        eventType: "job.completed",
        severity: "info",
        message: `Job ${publicId} completed successfully`,
        eventJson: result ?? {},
        createdAt: completedAt,
      }]);
    } else {
      await updateJobStatus(publicId, "failed", { errorMessage: error ?? "Unknown error", completedAt });
      await persistJobEvents([{
        jobId: details.job.id,
        eventType: "job.failed",
        severity: "error",
        message: `Job ${publicId} failed: ${error}`,
        eventJson: { error },
        createdAt: completedAt,
      }]);
    }

    return res.json(buildApiResponse(requestId, { status: success ? "succeeded" : "failed", publicId }));
  });

  // ─── Usage summary ────────────────────────────────────────────────────

  router.get("/usage/summary", async (_req, res) => {
    const requestId = res.locals.requestId as string;
    const usage = await getApiUsageSummary();
    return res.json(buildApiResponse(requestId, usage));
  });

  app.use("/api/v1", router);
}