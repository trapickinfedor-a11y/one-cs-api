import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createApiKeySchema,
  createBroadcastSchema,
  createBulkJobSchema,
  createJobSchema,
  jobFilterSchema,
  listApiKeysSchema,
  metricFilterSchema,
  revokeApiKeySchema,
  sendBotDocumentSchema,
  sendBotTextSchema,
  updateBotMessageSchema,
  updateBotTextSchema,
} from "../shared/platform";
import {
  createApiKeyRecord,
  createBroadcastCampaign,
  createBulkJob,
  createSafeImportedLeadBatch,
  createSingleJob,
  getAdminOverview,
  getApiUsageSummary,
  getBillingModule,
  getBotTextsModule,
  getBroadcastsModule,
  getJobDetails,
  getJobsModule,
  getOperatorLogsModule,
  getProxyModule,
  getRevenueAnalyticsModule,
  getSafeTestBench,
  getSystemModule,
  getTelemetryModule,
  getWorkersModule,
  listUserApiKeys,
  previewImportedLeadText,
  revokeUserApiKey,
  sendTelegramDocument,
  sendTelegramMessage,
  updateBotTextTemplate,
} from "./platformService";
import { updateWorkerNodeHeartbeat } from "./db";
import { getGlobalEngine, setGlobalEngine } from "./workerEngine";

// Re-export worker engine schemas for input validation
const workerConfigSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(128),
  concurrency: z.number().int().min(1).max(64).default(1),
  safeTestMode: z.boolean().default(false),
  maxRetries: z.number().int().min(1).max(10).default(3),
  proxyRotateAfterN: z.number().int().min(1).max(100).default(20),
  ssnTimeoutMs: z.number().int().min(1000).max(300_000).default(90_000),
  browserTimeoutMs: z.number().int().min(5000).max(600_000).default(60_000),
});

const workerSubmitJobSchema = z.object({
  jobPublicId: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()),
  proxyConfig: z.object({
    country: z.string().max(8).optional(),
    providerHint: z.string().max(64).optional(),
    sessionMode: z.enum(["rotating", "sticky", "hard_sticky"]).default("sticky"),
  }).optional(),
  priority: z.number().int().min(1).max(1000).default(100),
  queueName: z.string().max(64).default("default"),
  safeTestMode: z.boolean().default(false),
  maxRetries: z.number().int().min(1).max(10).default(3),
});

const jobsRouter = router({
  list: adminProcedure.input(jobFilterSchema.optional()).query(async () => {
    return getJobsModule();
  }),
  get: protectedProcedure
    .input(z.object({ publicId: z.string().min(3).max(64) }))
    .query(async ({ input }) => {
      return getJobDetails(input.publicId);
    }),
  createSafeSingle: adminProcedure.input(createJobSchema).mutation(async ({ ctx, input }) => {
    return createSingleJob(
      {
        ...input,
        safeTestMode: true,
      },
      { userId: ctx.user.id, source: "dashboard" },
    );
  }),
  createSafeBulk: adminProcedure.input(createBulkJobSchema).mutation(async ({ ctx, input }) => {
    return createBulkJob(
      {
        ...input,
        safeTestMode: true,
      },
      { userId: ctx.user.id, source: "dashboard" },
    );
  }),
});

const proxiesRouter = router({
  summary: adminProcedure.query(async () => {
    return getProxyModule();
  }),
});

const workersRouter = router({
  summary: adminProcedure.query(async () => {
    return getWorkersModule();
  }),
  heartbeat: protectedProcedure
    .input(
      z.object({
        workerNodeId: z.number().int().positive(),
        status: z.enum(["healthy", "degraded", "offline", "maintenance"]).optional(),
        activeJobs: z.number().int().min(0).optional(),
        concurrency: z.number().int().min(0).max(64).optional(),
        version: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return updateWorkerNodeHeartbeat(input.workerNodeId, {
        status: input.status,
        activeJobs: input.activeJobs,
        version: input.version,
        concurrencyLimit: input.concurrency,
      });
    }),

  /**
   * Start the global worker engine.
   * Initializes the pool and begins polling the job queue.
   */
  start: adminProcedure
    .input(
      z.object({
        maxWorkers: z.number().int().min(1).max(16).default(4),
        maxConcurrency: z.number().int().min(1).max(64).default(2),
        pollIntervalMs: z.number().int().min(1000).max(60_000).default(5000),
        heartbeatIntervalMs: z.number().int().min(5000).max(300_000).default(30_000),
      }).optional(),
    )
    .mutation(async () => {
      const engine = getGlobalEngine();
      if (engine.isRunning) {
        return { started: true, alreadyRunning: true, message: "Engine was already running." };
      }
      engine.start();
      return { started: true, alreadyRunning: false, message: "Worker engine started." };
    }),

  /**
   * Stop the global worker engine gracefully.
   * Waits for busy workers and releases all proxy sessions.
   */
  stop: adminProcedure.mutation(async () => {
    const engine = getGlobalEngine();
    if (!engine.isRunning) {
      return { stopped: true, wasRunning: false, message: "Engine was not running." };
    }
    await engine.stop();
    return { stopped: true, wasRunning: true, message: "Worker engine stopped." };
  }),

  /**
   * Get current worker engine status and pool statistics.
   */
  status: adminProcedure.query(async () => {
    const engine = getGlobalEngine();
    const { queueSize, activeWorkers } = engine.workerPool as { queueSize: number; activeWorkers: number; start: () => Promise<void>; stop: () => Promise<void> };
    return {
      isRunning: engine.isRunning,
      pool: {
        total: activeWorkers,
        idle: activeWorkers,
        busy: 0,
        offline: 0,
        maintenance: 0,
        totalCompleted: 0,
        totalFailed: 0,
        queueSize,
        activeWorkers,
      },
      workers: [] as Array<{ id: string; name: string; status: string; currentJob: null; startedAt: Date; lastHeartbeatAt: Date; completedJobs: number; failedJobs: number }>,
    };
  }),

  /**
   * Register a worker instance with the global pool.
   */
  register: adminProcedure
    .input(workerConfigSchema)
    .mutation(async ({ input }) => {
      const engine = getGlobalEngine();
      const worker = engine.registerWorker({
        id: input.id,
        name: input.name,
        concurrency: input.concurrency,
        safeTestMode: input.safeTestMode,
        maxRetries: input.maxRetries,
        proxyRotateAfterN: input.proxyRotateAfterN,
        ssnTimeoutMs: input.ssnTimeoutMs,
        browserTimeoutMs: input.browserTimeoutMs,
      });
      return { workerId: worker.id, name: worker.name, status: worker.status };
    }),

  /**
   * Deregister a worker from the global pool.
   */
  deregister: adminProcedure
    .input(z.object({ workerId: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => {
      const engine = getGlobalEngine();
      engine.deregisterWorker(input.workerId);
      return { workerId: input.workerId, deregistered: true };
    }),

  /**
   * Submit a job to an available worker in the pool.
   */
  submit: adminProcedure
    .input(workerSubmitJobSchema)
    .mutation(async ({ input }) => {
      const engine = getGlobalEngine();
      const result = await engine.submitJob({
        jobPublicId: input.jobPublicId,
        payload: input.payload as Record<string, unknown>,
        proxyConfig: input.proxyConfig ? {
          providerHint: input.proxyConfig.providerHint,
          country: input.proxyConfig.country,
        } : undefined,
        priority: input.priority,
        queueName: input.queueName,
        safeTestMode: input.safeTestMode,
        maxRetries: input.maxRetries,
      });
      return result;
    }),
});

const billingRouter = router({
  summary: adminProcedure.query(async () => {
    return getBillingModule();
  }),
  usage: protectedProcedure.query(async () => {
    return getApiUsageSummary();
  }),
});

const telemetryRouter = router({
  summary: adminProcedure.input(metricFilterSchema.optional()).query(async () => {
    return getTelemetryModule();
  }),
});

const revenueRouter = router({
  summary: adminProcedure.query(async () => {
    return getRevenueAnalyticsModule();
  }),
});

const logsRouter = router({
  summary: adminProcedure.query(async () => {
    return getOperatorLogsModule();
  }),
});

const platformRouter = router({
  overview: adminProcedure.query(async () => {
    return getAdminOverview();
  }),
  system: adminProcedure.query(async () => {
    return getSystemModule();
  }),
  safeTestBench: adminProcedure.query(async () => {
    return getSafeTestBench();
  }),
});

const apiKeysRouter = router({
  create: protectedProcedure.input(createApiKeySchema).mutation(async ({ ctx, input }) => {
    return createApiKeyRecord(ctx.user.id, input);
  }),
  list: protectedProcedure.input(listApiKeysSchema).query(async ({ ctx, input }) => {
    const requestedUserId = input?.userId;
    const effectiveUserId = ctx.user.role === "admin" ? requestedUserId : ctx.user.id;
    return listUserApiKeys(effectiveUserId);
  }),
  revoke: protectedProcedure.input(revokeApiKeySchema).mutation(async ({ ctx, input }) => {
    return revokeUserApiKey(ctx.user.id, input.id);
  }),
  usage: protectedProcedure.query(async () => {
    return getApiUsageSummary();
  }),
});

const importedDataRouter = router({
  preview: adminProcedure
    .input(z.object({ inputText: z.string().min(1).max(200000) }))
    .mutation(async ({ input }) => {
      return previewImportedLeadText(input.inputText);
    }),
  createSafeBatch: adminProcedure
    .input(z.object({ inputText: z.string().min(1).max(200000) }))
    .mutation(async ({ ctx, input }) => {
      return createSafeImportedLeadBatch(input.inputText, {
        userId: ctx.user.id,
        source: "dashboard",
      });
    }),
});

const botTextsRouter = router({
  summary: adminProcedure.query(async () => {
    return getBotTextsModule();
  }),
  update: adminProcedure.input(updateBotTextSchema).mutation(async ({ ctx, input }) => {
    return updateBotTextTemplate(input, { userId: ctx.user.id });
  }),
});

const botRouter = router({
  /**
   * Send a text message to a Telegram chat.
   * Requires BOT_TOKEN to be configured server-side.
   */
  sendText: adminProcedure.input(sendBotTextSchema).mutation(async ({ input }) => {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) {
      throw new Error("BOT_TOKEN is not configured on the server.");
    }
    return sendTelegramMessage({
      botToken: token,
      chatId: input.chatId,
      text: input.text,
      parseMode: input.parseMode,
    });
  }),

  /**
   * Send a document (by URL) to a Telegram chat.
   * Used for CSV reports, batch results, etc.
   */
  sendDocument: adminProcedure.input(sendBotDocumentSchema).mutation(async ({ input }) => {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) {
      throw new Error("BOT_TOKEN is not configured on the server.");
    }
    return sendTelegramDocument({
      botToken: token,
      chatId: input.chatId,
      url: input.url,
      caption: input.caption,
      parseMode: input.parseMode,
    });
  }),

  /**
   * Edit an existing bot message text.
   */
  updateMessage: adminProcedure.input(updateBotMessageSchema).mutation(async ({ input }) => {
    const token = process.env.BOT_TOKEN?.trim();
    if (!token) {
      throw new Error("BOT_TOKEN is not configured on the server.");
    }
    const response = await fetch(
      `https://api.telegram.org/bot${token}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: input.chatId,
          message_id: input.messageId,
          text: input.text,
          parse_mode: input.parseMode !== "plain" ? input.parseMode : undefined,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.description || `Telegram API responded with ${response.status}`);
    }
    return { ok: true, messageId: input.messageId };
  }),
});

const broadcastsRouter = router({
  summary: adminProcedure.query(async () => {
    return getBroadcastsModule();
  }),
  create: adminProcedure.input(createBroadcastSchema).mutation(async ({ ctx, input }) => {
    return createBroadcastCampaign(input, { userId: ctx.user.id });
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  jobs: jobsRouter,
  proxies: proxiesRouter,
  workers: workersRouter,
  billing: billingRouter,
  telemetry: telemetryRouter,
  revenue: revenueRouter,
  logs: logsRouter,
  platform: platformRouter,
  apiKeys: apiKeysRouter,
  importedData: importedDataRouter,
  botTexts: botTextsRouter,
  bot: botRouter,
  broadcasts: broadcastsRouter,
  publicApi: router({
    health: publicProcedure.query(async () => {
      const system = await getSystemModule();
      return system.health;
    }),
  }),
});

export type AppRouter = typeof appRouter;
