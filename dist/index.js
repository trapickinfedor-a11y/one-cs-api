var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      // Server
      port: parseInt(process.env.PORT ?? "3000"),
      nodeEnv: process.env.NODE_ENV ?? "development",
      isProduction: process.env.NODE_ENV === "production",
      // Database
      databaseUrl: process.env.DATABASE_URL ?? "",
      // Auth
      jwtSecret: process.env.JWT_SECRET ?? "",
      adminUsername: process.env.ADMIN_USERNAME ?? "admin",
      adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
      // bcrypt hash
      privateApiKey: process.env.PRIVATE_API_KEY ?? "",
      // for external callers
      // Legacy OAuth / Manus fields (kept for compatibility with existing modules)
      appId: process.env.VITE_APP_ID ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      // Forge / built-in API
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      // ONE CS API
      oneCsApiUrl: process.env.ONE_CS_API_URL ?? "https://api.onecs.ai/v1",
      oneCsApiKey: process.env.ONE_CS_API_KEY ?? "",
      oneCsApiTimeoutMs: parseInt(process.env.ONE_CS_API_TIMEOUT_MS ?? "30000", 10),
      oneCsApiRetries: parseInt(process.env.ONE_CS_API_RETRIES ?? "3", 10),
      // Evomi proxy (primary)
      evomiUsername: process.env.EVOMI_USERNAME ?? "",
      evomiPassword: process.env.EVOMI_PASSWORD ?? "",
      evomiApiKey: process.env.EVOMI_API_KEY ?? "",
      evomiApiUrl: process.env.EVOMI_API_URL ?? "",
      // DataImpulse proxy (fallback)
      dataImpulseApiKey: process.env.DATAIMPULSE_API_KEY ?? "",
      dataImpulseUsername: process.env.DATAIMPULSE_USERNAME ?? "",
      dataImpulsePassword: process.env.DATAIMPULSE_PASSWORD ?? "",
      // Proxy session config
      rotateAfterNSuccess: parseInt(process.env.ROTATE_AFTER_N_SUCCESS ?? "20", 10),
      sessionTtlMinutes: parseInt(process.env.SESSION_TTL_MINUTES ?? "1440", 10),
      rotateOnErrorCount: parseInt(process.env.ROTATE_ON_ERROR_COUNT ?? "2", 10),
      // Redis (for multi-worker coordination, optional)
      redisUrl: process.env.REDIS_URL ?? "",
      // Telegram (optional)
      botToken: process.env.BOT_TOKEN ?? ""
    };
  }
});

// shared/platform.ts
import { z as z2 } from "zod";
var requestModes, jobStatuses, jobSources, proxyProviderStatuses, proxySessionModes, planTiers, apiKeyScopes, botTextKeys, broadcastAudienceKinds, broadcastParseModes, jsonRecordSchema, paginationSchema, dateRangeSchema, proxyConfigSchema, createJobSchema, bulkJobItemSchema, createBulkJobSchema, createApiKeySchema, listApiKeysSchema, revokeApiKeySchema, createPlanSchema, providerConfigSchema, metricFilterSchema, jobFilterSchema, updateBotTextSchema, createBroadcastSchema, safeTestScenarioSchema, botParseModes, sendBotTextSchema, sendBotDocumentSchema, updateBotMessageSchema, SAFE_TEST_SCENARIOS;
var init_platform = __esm({
  "shared/platform.ts"() {
    "use strict";
    requestModes = ["single", "bulk", "vip"];
    jobStatuses = ["queued", "running", "succeeded", "failed", "canceled", "waiting_retry"];
    jobSources = ["dashboard", "api", "telegram", "system", "testbench", "browser"];
    proxyProviderStatuses = ["healthy", "degraded", "disabled"];
    proxySessionModes = ["rotating", "sticky", "hard_sticky"];
    planTiers = ["starter", "pro", "vip", "enterprise"];
    apiKeyScopes = ["single", "bulk", "vip", "admin"];
    botTextKeys = ["welcome", "paymentReminder", "retryNotice", "supportReply", "maintenanceBanner"];
    broadcastAudienceKinds = ["linked_telegram_users", "manual_chat_ids"];
    broadcastParseModes = ["plain"];
    jsonRecordSchema = z2.record(z2.string(), z2.unknown());
    paginationSchema = z2.object({
      page: z2.number().int().min(1).default(1),
      pageSize: z2.number().int().min(1).max(100).default(20)
    });
    dateRangeSchema = z2.object({
      from: z2.number().int().optional(),
      to: z2.number().int().optional()
    });
    proxyConfigSchema = z2.object({
      country: z2.string().max(8).optional(),
      state: z2.string().max(64).optional(),
      city: z2.string().max(128).optional(),
      protocol: z2.enum(["http", "socks5"]).default("http"),
      sessionMode: z2.enum(proxySessionModes).default("rotating"),
      stickyTtlMinutes: z2.number().int().min(1).max(1440).optional(),
      providerHint: z2.string().max(64).optional(),
      costCeilingUsd: z2.number().min(0).optional(),
      maxTransportRetries: z2.number().int().min(0).max(10).default(2),
      maxProviderSwitches: z2.number().int().min(0).max(10).default(1)
    });
    createJobSchema = z2.object({
      requestMode: z2.enum(requestModes),
      targetLabel: z2.string().max(191).optional(),
      queueName: z2.string().max(64).default("default"),
      priority: z2.number().int().min(1).max(1e3).default(100),
      payload: jsonRecordSchema,
      proxy: proxyConfigSchema.optional(),
      profilePolicy: z2.string().max(128).optional(),
      fingerprintProfile: z2.string().max(128).optional(),
      safeTestMode: z2.boolean().default(false)
    });
    bulkJobItemSchema = z2.object({
      externalId: z2.string().max(128).optional(),
      payload: jsonRecordSchema
    });
    createBulkJobSchema = z2.object({
      queueName: z2.string().max(64).default("bulk"),
      priority: z2.number().int().min(1).max(1e3).default(120),
      items: z2.array(bulkJobItemSchema).min(1).max(1e3),
      proxy: proxyConfigSchema.optional(),
      safeTestMode: z2.boolean().default(false)
    });
    createApiKeySchema = z2.object({
      label: z2.string().min(2).max(128),
      scope: z2.enum(apiKeyScopes),
      rpmLimit: z2.number().int().min(1).max(1e4).default(60),
      dailyLimit: z2.number().int().min(1).max(1e6).default(1e3),
      expiresAt: z2.number().int().optional()
    });
    listApiKeysSchema = z2.object({
      userId: z2.number().int().positive().optional()
    }).optional();
    revokeApiKeySchema = z2.object({
      id: z2.number().int().positive()
    });
    createPlanSchema = z2.object({
      code: z2.string().min(2).max(64),
      name: z2.string().min(2).max(128),
      tier: z2.enum(planTiers),
      billingInterval: z2.enum(["one_time", "monthly", "quarterly", "yearly"]),
      currency: z2.string().min(3).max(12).default("USD"),
      priceUsd: z2.number().min(0),
      includedRequests: z2.number().int().min(0).default(0),
      monthlyApiQuota: z2.number().int().min(0).default(0),
      monthlyBrowserRuns: z2.number().int().min(0).default(0),
      maxRpm: z2.number().int().min(1).default(60),
      maxConcurrentJobs: z2.number().int().min(1).default(1),
      vipApiAccess: z2.boolean().default(false),
      features: z2.array(z2.string()).default([])
    });
    providerConfigSchema = z2.object({
      code: z2.string().min(2).max(64),
      name: z2.string().min(2).max(128),
      protocolSupport: z2.string().min(2).max(128),
      sessionSupport: z2.string().min(2).max(128),
      costPerGbUsd: z2.number().min(0),
      priority: z2.number().int().min(1).max(1e3).default(100),
      status: z2.enum(proxyProviderStatuses).default("healthy"),
      notes: z2.string().max(5e3).optional(),
      config: jsonRecordSchema.optional()
    });
    metricFilterSchema = paginationSchema.extend({
      snapshotType: z2.enum(["system", "provider", "queue", "billing", "job"]).optional(),
      scopeKey: z2.string().max(128).optional(),
      range: dateRangeSchema.optional()
    });
    jobFilterSchema = paginationSchema.extend({
      status: z2.enum(jobStatuses).optional(),
      requestMode: z2.enum(requestModes).optional(),
      source: z2.enum(jobSources).optional(),
      queueName: z2.string().max(64).optional(),
      range: dateRangeSchema.optional()
    });
    updateBotTextSchema = z2.object({
      key: z2.enum(botTextKeys),
      body: z2.string().min(1).max(2e4),
      title: z2.string().min(2).max(128).optional(),
      description: z2.string().max(500).optional()
    });
    createBroadcastSchema = z2.object({
      title: z2.string().min(2).max(128),
      message: z2.string().min(1).max(4e3),
      audience: z2.enum(broadcastAudienceKinds),
      parseMode: z2.enum(broadcastParseModes).default("plain"),
      manualChatIds: z2.array(z2.string().min(2).max(64)).default([]),
      dryRun: z2.boolean().default(false)
    });
    safeTestScenarioSchema = z2.object({
      code: z2.string().min(2).max(64),
      title: z2.string().min(2).max(128),
      description: z2.string().max(1e3),
      expectedOutcome: z2.string().max(1e3),
      mockPayload: jsonRecordSchema
    });
    botParseModes = ["plain", "html", "markdown"];
    sendBotTextSchema = z2.object({
      chatId: z2.string().min(1).max(64),
      text: z2.string().min(1).max(4096),
      parseMode: z2.enum(botParseModes).default("html"),
      disableWebPagePreview: z2.boolean().default(true)
    });
    sendBotDocumentSchema = z2.object({
      chatId: z2.string().min(1).max(64),
      url: z2.string().url().max(512),
      caption: z2.string().max(1024).optional(),
      parseMode: z2.enum(botParseModes).default("html")
    });
    updateBotMessageSchema = z2.object({
      chatId: z2.string().min(1).max(64),
      messageId: z2.number().int().positive(),
      text: z2.string().min(1).max(4096),
      parseMode: z2.enum(botParseModes).default("html")
    });
    SAFE_TEST_SCENARIOS = [
      {
        code: "single_success_mock",
        title: "Single request success",
        description: "\u042D\u043C\u0443\u043B\u044F\u0446\u0438\u044F \u043E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0433\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0441 \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u043C \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u043E\u0447\u0435\u0440\u0435\u0434\u0438, lease \u0438 worker run.",
        expectedOutcome: "Job \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442 \u0432 succeeded, usage \u0438 audit trail \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E.",
        mockPayload: {
          target: "mock://catalog/item/42",
          action: "extract",
          expectedTransport: "mock-http"
        }
      },
      {
        code: "provider_fallback_mock",
        title: "Provider fallback",
        description: "\u042D\u043C\u0443\u043B\u044F\u0446\u0438\u044F \u0434\u0435\u0433\u0440\u0430\u0434\u0430\u0446\u0438\u0438 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u043A\u0441\u0438-\u043F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440\u0430 \u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043D\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0439.",
        expectedOutcome: "\u0421\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F warning event, lease \u043E\u0442\u043C\u0435\u0447\u0430\u0435\u0442 fallback, \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442\u0441\u044F \u0431\u0435\u0437 \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0432\u044B\u0437\u043E\u0432\u0430.",
        mockPayload: {
          target: "mock://provider/fallback",
          action: "extract",
          simulateProviderFailure: true
        }
      },
      {
        code: "retry_then_success_mock",
        title: "Retry then success",
        description: "\u042D\u043C\u0443\u043B\u044F\u0446\u0438\u044F \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0439 \u043E\u0448\u0438\u0431\u043A\u0438 \u043D\u0430 \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u043E\u043F\u044B\u0442\u043A\u0435 \u0438 \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0433\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043D\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439.",
        expectedOutcome: "Job \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442 \u0447\u0435\u0440\u0435\u0437 waiting_retry, workerRuns \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u044E\u0442 2 \u043F\u043E\u043F\u044B\u0442\u043A\u0438, \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 succeeded.",
        mockPayload: {
          target: "mock://retry/case",
          action: "extract",
          simulateRetryableError: true
        }
      }
    ];
  }
});

// shared/oneCsScoring.ts
import { z as z3 } from "zod";
function clamp(min, value, max) {
  return Math.min(max, Math.max(min, value));
}
function round1(value) {
  return Math.round(value * 10) / 10;
}
function normalizeAdverseReason(reason) {
  const compact = reason.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  const matched = REASON_TO_GROUP.find((entry) => entry.pattern.test(compact));
  if (!matched) {
    return {
      original: compact,
      normalized: compact,
      group: null
    };
  }
  return {
    original: compact,
    normalized: matched.normalized,
    group: matched.group
  };
}
function normalizeAdverseReasons(reasons = []) {
  const seenReasons = /* @__PURE__ */ new Set();
  const seenGroups = /* @__PURE__ */ new Set();
  const normalizedReasons = [];
  const groups = [];
  for (const reason of reasons) {
    const normalized = normalizeAdverseReason(reason);
    if (!seenReasons.has(normalized.normalized)) {
      seenReasons.add(normalized.normalized);
      normalizedReasons.push(normalized.normalized);
    }
    if (normalized.group && !seenGroups.has(normalized.group)) {
      seenGroups.add(normalized.group);
      groups.push(normalized.group);
    }
  }
  return {
    adverseReasons: normalizedReasons,
    adverseReasonGroups: groups
  };
}
function deriveProductScore(creditScore) {
  if (creditScore == null) return 1;
  const transformed = Math.round((creditScore - 300) / 550 * 19) + 1;
  return clamp(1, transformed, 20);
}
function getBaseQualityFromCreditScore(creditScore) {
  if (creditScore == null) return 2;
  if (creditScore >= 850) return 10;
  if (creditScore >= 800) return 9.7;
  if (creditScore >= 760) return 9;
  if (creditScore >= 720) return 8;
  if (creditScore >= 680) return 7.4;
  if (creditScore >= 640) return 6.5;
  if (creditScore >= 600) return 5.5;
  if (creditScore >= 560) return 4.5;
  if (creditScore >= 520) return 3.5;
  if (creditScore >= 480) return 2.5;
  return 1.5;
}
function getCompletenessAdjustment(completenessScore) {
  const value = completenessScore ?? 0.65;
  if (value >= 0.95) return 0.8;
  if (value >= 0.8) return 0.5;
  if (value >= 0.65) return 0.2;
  if (value >= 0.5) return 0;
  if (value >= 0.35) return -0.3;
  return -0.8;
}
function derivePenaltyFromReasonGroups(groups) {
  const total = groups.reduce((sum, group) => sum + GROUP_PENALTIES[group], 0);
  return Math.min(6.5, round1(total));
}
function deriveOneCsStatus(input) {
  if (input.creditScore == null && input.adverseReasonGroups.includes("no_file")) {
    return "no_file";
  }
  if (input.creditScore == null && input.adverseReasonGroups.length <= 1) {
    return "review";
  }
  if (input.dataQualityScore >= 7.5) {
    return "success";
  }
  if (input.dataQualityScore >= 4) {
    return "review";
  }
  return "decline";
}
function buildOneCsExplanations(result) {
  const explanations = [];
  if (result.creditScore == null) {
    explanations.push("Credit score was not found, so the profile starts from a low confidence baseline.");
  } else {
    explanations.push(`Raw credit score ${result.creditScore} mapped to product score ${result.productScore}/20.`);
  }
  if (typeof result.completenessScore === "number") {
    explanations.push(`Record completeness contributed ${Math.round(result.completenessScore * 100)}% of the available lead signals.`);
  }
  if (result.adverseReasonGroups.includes("public_record")) {
    explanations.push("Public record or collection signals materially reduced data quality.");
  }
  if (result.adverseReasonGroups.includes("delinquency")) {
    explanations.push("Recent or repeated delinquency pressure reduced the final score.");
  }
  if (result.adverseReasonGroups.includes("affordability")) {
    explanations.push("Income and debt affordability signals indicate lower financing readiness.");
  }
  if (result.adverseReasonGroups.includes("thin_file") || result.adverseReasonGroups.includes("low_depth")) {
    explanations.push("Thin or shallow credit history reduced confidence in profile stability.");
  }
  if (result.adverseReasonGroups.includes("utilization")) {
    explanations.push("High utilization or too many balances reduced quality despite other available signals.");
  }
  if (result.adverseReasonGroups.includes("inquiry_pressure")) {
    explanations.push("Recent inquiry pressure added a smaller negative adjustment.");
  }
  if (result.adverseReasons.length === 0 && (result.creditScore ?? 0) >= 720) {
    explanations.push("No adverse reasons were detected for a strong score band, so the profile received a small positive bonus.");
  }
  explanations.push(`Final status: ${result.status}, data quality ${result.dataQualityScore}/10.`);
  return explanations;
}
function deriveDataQualityScore(input) {
  const normalized = normalizeAdverseReasons(input.adverseReasons ?? []);
  const baseQuality = getBaseQualityFromCreditScore(input.creditScore);
  const completenessAdjustment = getCompletenessAdjustment(input.completenessScore);
  const penalty = derivePenaltyFromReasonGroups(normalized.adverseReasonGroups);
  const bonus = normalized.adverseReasonGroups.length === 0 && (input.creditScore ?? 0) >= 720 ? 0.3 : 0;
  const dataQualityScore = round1(clamp(1, baseQuality + completenessAdjustment + bonus - penalty, 10));
  return {
    dataQualityScore,
    baseQuality,
    completenessAdjustment,
    penalty,
    bonus,
    adverseReasons: normalized.adverseReasons,
    adverseReasonGroups: normalized.adverseReasonGroups
  };
}
function buildOneCsResult(input) {
  const productScore = deriveProductScore(input.creditScore);
  const quality = deriveDataQualityScore({
    creditScore: input.creditScore,
    completenessScore: input.completenessScore,
    adverseReasons: input.adverseReasons
  });
  const status = deriveOneCsStatus({
    creditScore: input.creditScore,
    dataQualityScore: quality.dataQualityScore,
    adverseReasonGroups: quality.adverseReasonGroups
  });
  return oneCsResultSchema.parse({
    creditScore: input.creditScore,
    productScore,
    dataQualityScore: quality.dataQualityScore,
    adverseReasons: quality.adverseReasons,
    adverseReasonGroups: quality.adverseReasonGroups,
    status,
    priceUsd: Number((input.priceUsd ?? 0).toFixed(2)),
    durationMs: Math.max(0, Math.round(input.durationMs ?? 0)),
    source: input.source,
    explanations: buildOneCsExplanations({
      creditScore: input.creditScore,
      completenessScore: input.completenessScore,
      adverseReasons: quality.adverseReasons,
      adverseReasonGroups: quality.adverseReasonGroups,
      productScore,
      dataQualityScore: quality.dataQualityScore,
      status
    }),
    completenessScore: input.completenessScore ?? void 0
  });
}
var oneCsStatusValues, adverseReasonGroupValues, oneCsResultSchema, REASON_TO_GROUP, GROUP_PENALTIES;
var init_oneCsScoring = __esm({
  "shared/oneCsScoring.ts"() {
    "use strict";
    oneCsStatusValues = ["success", "review", "decline", "no_file", "error"];
    adverseReasonGroupValues = [
      "no_file",
      "thin_file",
      "low_depth",
      "affordability",
      "utilization",
      "delinquency",
      "public_record",
      "inquiry_pressure",
      "consumer_finance"
    ];
    oneCsResultSchema = z3.object({
      creditScore: z3.number().int().min(300).max(850).nullable(),
      productScore: z3.number().min(1).max(20),
      dataQualityScore: z3.number().min(1).max(10),
      adverseReasons: z3.array(z3.string()),
      adverseReasonGroups: z3.array(z3.enum(adverseReasonGroupValues)),
      status: z3.enum(oneCsStatusValues),
      priceUsd: z3.number().min(0),
      durationMs: z3.number().int().min(0),
      source: z3.enum(["dashboard", "api", "telegram", "import", "system", "testbench"]),
      explanations: z3.array(z3.string()),
      completenessScore: z3.number().min(0).max(1).optional()
    });
    REASON_TO_GROUP = [
      {
        pattern: /^Unable to find credit profile at TransUnion$/i,
        normalized: "Unable to find credit profile at TransUnion",
        group: "no_file"
      },
      {
        pattern: /^Insufficient credit history$/i,
        normalized: "Insufficient credit history",
        group: "thin_file"
      },
      {
        pattern: /^Insufficient length of credit history$/i,
        normalized: "Insufficient length of credit history",
        group: "thin_file"
      },
      {
        pattern: /^Insufficient number of accounts$/i,
        normalized: "Insufficient number of accounts",
        group: "thin_file"
      },
      {
        pattern: /^Insufficient number of open accounts$/i,
        normalized: "Insufficient number of open accounts",
        group: "thin_file"
      },
      {
        pattern: /^Lack of recent installment loan information$/i,
        normalized: "Lack of recent installment loan information",
        group: "low_depth"
      },
      {
        pattern: /^Lack of recent revolving account information$/i,
        normalized: "Lack of recent revolving account information",
        group: "low_depth"
      },
      {
        pattern: /^Lack of recent bank\/national revolving information$/i,
        normalized: "Lack of recent bank/national revolving information",
        group: "low_depth"
      },
      {
        pattern: /^No recent revolving balances$/i,
        normalized: "No recent revolving balances",
        group: "low_depth"
      },
      {
        pattern: /^No recent bank\/national revolving balances$/i,
        normalized: "No recent bank/national revolving balances",
        group: "low_depth"
      },
      {
        pattern: /^Too few accounts currently paid as agreed$/i,
        normalized: "Too few accounts currently paid as agreed",
        group: "low_depth"
      },
      {
        pattern: /^Income or credit history insufficient for loan$/i,
        normalized: "Income or credit history insufficient for loan",
        group: "affordability"
      },
      {
        pattern: /^Requested amount unsupported by income$/i,
        normalized: "Requested amount unsupported by income",
        group: "affordability"
      },
      {
        pattern: /^High debt in relation to income$/i,
        normalized: "High debt in relation to income",
        group: "affordability"
      },
      {
        pattern: /^Proportion of loan balances to loan amounts is too high$/i,
        normalized: "Proportion of loan balances to loan amounts is too high",
        group: "affordability"
      },
      {
        pattern: /^Proportion of balances to credit limits on bank\/national revolving or other revolving accounts is too high$/i,
        normalized: "Proportion of balances to credit limits on bank/national revolving or other revolving accounts is too high",
        group: "utilization"
      },
      {
        pattern: /^Too many accounts with balances$/i,
        normalized: "Too many accounts with balances",
        group: "utilization"
      },
      {
        pattern: /^Serious delinquency$/i,
        normalized: "Serious delinquency",
        group: "delinquency"
      },
      {
        pattern: /^Number of accounts with delinquency$/i,
        normalized: "Number of accounts with delinquency",
        group: "delinquency"
      },
      {
        pattern: /^Time since delinquency is too recent or unknown$/i,
        normalized: "Time since delinquency is too recent or unknown",
        group: "delinquency"
      },
      {
        pattern: /^Serious delinquency, and public record or collection filed$/i,
        normalized: "Serious delinquency, and public record or collection filed",
        group: "public_record"
      },
      {
        pattern: /^Serious delinquency, public record, or collection filed$/i,
        normalized: "Serious delinquency, and public record or collection filed",
        group: "public_record"
      },
      {
        pattern: /^Derogatory public record or collection filed$/i,
        normalized: "Serious delinquency, and public record or collection filed",
        group: "public_record"
      },
      {
        pattern: /^RiskView Consumer Inquiry$/i,
        normalized: "RiskView Consumer Inquiry",
        group: "inquiry_pressure"
      },
      {
        pattern: /^Too many inquiries last 12 months$/i,
        normalized: "Too many inquiries last 12 months",
        group: "inquiry_pressure"
      },
      {
        pattern: /^High number of recent inquiries$/i,
        normalized: "High number of recent inquiries",
        group: "inquiry_pressure"
      },
      {
        pattern: /^Too many consumer finance company accounts$/i,
        normalized: "Too many consumer finance company accounts",
        group: "consumer_finance"
      }
    ];
    GROUP_PENALTIES = {
      no_file: 5,
      thin_file: 2.2,
      low_depth: 1.4,
      affordability: 2,
      utilization: 1.6,
      delinquency: 2.4,
      public_record: 3.2,
      inquiry_pressure: 1,
      consumer_finance: 0.8
    };
  }
});

// server/runtimeStore.ts
var runtimeStore_exports = {};
__export(runtimeStore_exports, {
  findRuntimeApiKeyByHash: () => findRuntimeApiKeyByHash,
  findRuntimeJob: () => findRuntimeJob,
  getCurrentPeriodKey: () => getCurrentPeriodKey,
  getRuntimeAdminByUsername: () => getRuntimeAdminByUsername,
  getRuntimeUsageSummary: () => getRuntimeUsageSummary,
  initRuntimeDefaultAdmin: () => initRuntimeDefaultAdmin,
  listRuntimeApiKeys: () => listRuntimeApiKeys,
  listRuntimeAuditTrailEntries: () => listRuntimeAuditTrailEntries,
  listRuntimeBotTexts: () => listRuntimeBotTexts,
  listRuntimeBroadcasts: () => listRuntimeBroadcasts,
  listRuntimeJobEventsByJobId: () => listRuntimeJobEventsByJobId,
  listRuntimeJobs: () => listRuntimeJobs,
  listRuntimeProxyLeases: () => listRuntimeProxyLeases,
  listRuntimeTelegramRecipients: () => listRuntimeTelegramRecipients,
  listRuntimeUsageRecords: () => listRuntimeUsageRecords,
  listRuntimeWorkerNodes: () => listRuntimeWorkerNodes,
  listRuntimeWorkerRuns: () => listRuntimeWorkerRuns,
  resetRuntimeStore: () => resetRuntimeStore,
  saveRuntimeAdmin: () => saveRuntimeAdmin,
  saveRuntimeApiKey: () => saveRuntimeApiKey,
  saveRuntimeAuditTrailEntry: () => saveRuntimeAuditTrailEntry,
  saveRuntimeBotText: () => saveRuntimeBotText,
  saveRuntimeBroadcast: () => saveRuntimeBroadcast,
  saveRuntimeJob: () => saveRuntimeJob,
  saveRuntimeJobEvents: () => saveRuntimeJobEvents,
  saveRuntimeProxyLease: () => saveRuntimeProxyLease,
  saveRuntimeTelegramRecipient: () => saveRuntimeTelegramRecipient,
  saveRuntimeUsageRecord: () => saveRuntimeUsageRecord,
  saveRuntimeWorkerRun: () => saveRuntimeWorkerRun,
  updateRuntimeApiKey: () => updateRuntimeApiKey,
  updateRuntimeJob: () => updateRuntimeJob,
  updateRuntimeProxyLease: () => updateRuntimeProxyLease,
  updateRuntimeWorkerNode: () => updateRuntimeWorkerNode
});
function nextRuntimeId() {
  return 1e9 + nextIdCounter++;
}
function cloneDate(value) {
  return value ? new Date(value) : null;
}
function toDecimalString(value, precision = 4) {
  if (typeof value === "string") {
    return value;
  }
  return value.toFixed(precision);
}
function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}
function cloneJob(job) {
  return {
    ...job,
    createdAt: new Date(job.createdAt),
    startedAt: cloneDate(job.startedAt),
    completedAt: cloneDate(job.completedAt)
  };
}
function cloneJobEvent(event) {
  return {
    ...event,
    createdAt: new Date(event.createdAt)
  };
}
function cloneApiKey(apiKey) {
  return {
    ...apiKey,
    createdAt: new Date(apiKey.createdAt),
    updatedAt: new Date(apiKey.updatedAt),
    lastUsedAt: cloneDate(apiKey.lastUsedAt),
    expiresAt: cloneDate(apiKey.expiresAt)
  };
}
function cloneAudit(entry) {
  return {
    ...entry,
    createdAt: new Date(entry.createdAt)
  };
}
function cloneUsage(record) {
  return {
    ...record,
    createdAt: new Date(record.createdAt)
  };
}
function cloneWorkerRun(run) {
  return {
    ...run,
    createdAt: new Date(run.createdAt),
    finishedAt: cloneDate(run.finishedAt)
  };
}
function cloneProxyLease(lease) {
  return {
    ...lease,
    createdAt: new Date(lease.createdAt),
    expiresAt: cloneDate(lease.expiresAt),
    releasedAt: cloneDate(lease.releasedAt)
  };
}
function cloneBotText(record) {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt)
  };
}
function cloneBroadcast(record) {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    completedAt: cloneDate(record.completedAt)
  };
}
function cloneTelegramRecipient(record) {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt)
  };
}
function initRuntimeDefaultAdmin(username, passwordHash) {
  const existing = runtimeAdmins.find((a) => a.username === username);
  if (!existing) {
    runtimeAdmins.push({
      id: 1,
      username,
      passwordHash,
      role: "admin",
      createdAt: /* @__PURE__ */ new Date()
    });
  }
}
function getRuntimeAdminByUsername(username) {
  return runtimeAdmins.find((a) => a.username === username);
}
function saveRuntimeAdmin(input) {
  const existingIndex = runtimeAdmins.findIndex((a) => a.username === input.username);
  const record = {
    ...input,
    id: existingIndex >= 0 ? runtimeAdmins[existingIndex].id : input.id ?? nextRuntimeId(),
    createdAt: existingIndex >= 0 ? runtimeAdmins[existingIndex].createdAt : input.createdAt
  };
  if (existingIndex >= 0) {
    runtimeAdmins[existingIndex] = record;
  } else {
    runtimeAdmins.unshift(record);
  }
  return record;
}
function getCurrentPeriodKey(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function resetRuntimeStore() {
  runtimeAdmins.length = 0;
  runtimeJobs.length = 0;
  runtimeJobEvents.length = 0;
  runtimeApiKeys.length = 0;
  runtimeAuditTrail.length = 0;
  runtimeUsageRecords.length = 0;
  runtimeWorkerRuns.length = 0;
  runtimeProxyLeases.length = 0;
  runtimeBotTexts.length = 0;
  runtimeBroadcasts.length = 0;
  runtimeTelegramRecipients.length = 0;
  runtimeWorkerNodes.length = 0;
  nextIdCounter = 1;
}
function saveRuntimeJob(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId()
  };
  runtimeJobs.unshift(record);
  return cloneJob(record);
}
function listRuntimeJobs() {
  return runtimeJobs.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneJob);
}
function findRuntimeJob(publicId) {
  const record = runtimeJobs.find((job) => job.publicId === publicId);
  return record ? cloneJob(record) : null;
}
function updateRuntimeJob(id, patch) {
  const index2 = runtimeJobs.findIndex((job) => job.id === id);
  if (index2 === -1) {
    return null;
  }
  const nextRecord = {
    ...runtimeJobs[index2],
    ...patch,
    id: runtimeJobs[index2].id,
    createdAt: patch.createdAt ?? runtimeJobs[index2].createdAt,
    startedAt: patch.startedAt === void 0 ? runtimeJobs[index2].startedAt : patch.startedAt,
    completedAt: patch.completedAt === void 0 ? runtimeJobs[index2].completedAt : patch.completedAt
  };
  runtimeJobs[index2] = nextRecord;
  return cloneJob(nextRecord);
}
function saveRuntimeJobEvents(inputs) {
  const saved = inputs.map((input) => {
    const record = {
      ...input,
      id: input.id ?? nextRuntimeId()
    };
    runtimeJobEvents.unshift(record);
    return record;
  });
  return saved.map(cloneJobEvent);
}
function listRuntimeJobEventsByJobId(jobId) {
  return runtimeJobEvents.filter((event) => event.jobId === jobId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneJobEvent);
}
function saveRuntimeApiKey(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId()
  };
  runtimeApiKeys.unshift(record);
  return cloneApiKey(record);
}
function listRuntimeApiKeys(userId) {
  return runtimeApiKeys.filter((apiKey) => userId ? apiKey.userId === userId : true).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneApiKey);
}
function findRuntimeApiKeyByHash(keyHash) {
  const record = runtimeApiKeys.find((apiKey) => apiKey.keyHash === keyHash);
  return record ? cloneApiKey(record) : null;
}
function updateRuntimeApiKey(id, patch) {
  const index2 = runtimeApiKeys.findIndex((apiKey) => apiKey.id === id);
  if (index2 === -1) {
    return null;
  }
  const nextRecord = {
    ...runtimeApiKeys[index2],
    ...patch,
    id: runtimeApiKeys[index2].id,
    userId: runtimeApiKeys[index2].userId,
    keyPrefix: runtimeApiKeys[index2].keyPrefix,
    keyHash: runtimeApiKeys[index2].keyHash,
    createdAt: patch.createdAt ?? runtimeApiKeys[index2].createdAt,
    updatedAt: patch.updatedAt ?? runtimeApiKeys[index2].updatedAt,
    lastUsedAt: patch.lastUsedAt === void 0 ? runtimeApiKeys[index2].lastUsedAt : patch.lastUsedAt,
    expiresAt: patch.expiresAt === void 0 ? runtimeApiKeys[index2].expiresAt : patch.expiresAt
  };
  runtimeApiKeys[index2] = nextRecord;
  return cloneApiKey(nextRecord);
}
function saveRuntimeAuditTrailEntry(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId()
  };
  runtimeAuditTrail.unshift(record);
  return cloneAudit(record);
}
function listRuntimeAuditTrailEntries() {
  return runtimeAuditTrail.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneAudit);
}
function saveRuntimeUsageRecord(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId(),
    quantity: toDecimalString(input.quantity),
    unitCostUsd: toDecimalString(input.unitCostUsd),
    totalCostUsd: toDecimalString(input.totalCostUsd)
  };
  runtimeUsageRecords.unshift(record);
  return cloneUsage(record);
}
function listRuntimeUsageRecords() {
  return runtimeUsageRecords.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneUsage);
}
function saveRuntimeWorkerRun(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId()
  };
  runtimeWorkerRuns.unshift(record);
  return cloneWorkerRun(record);
}
function listRuntimeWorkerRuns() {
  return runtimeWorkerRuns.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneWorkerRun);
}
function saveRuntimeProxyLease(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId(),
    estimatedCostUsd: toDecimalString(input.estimatedCostUsd)
  };
  runtimeProxyLeases.unshift(record);
  return cloneProxyLease(record);
}
function listRuntimeProxyLeases() {
  return runtimeProxyLeases.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneProxyLease);
}
function updateRuntimeProxyLease(leaseId, patch) {
  const index2 = runtimeProxyLeases.findIndex((lease) => lease.leaseId === leaseId);
  if (index2 === -1) {
    return null;
  }
  const nextRecord = {
    ...runtimeProxyLeases[index2],
    ...patch,
    id: runtimeProxyLeases[index2].id,
    leaseId: runtimeProxyLeases[index2].leaseId,
    createdAt: patch.createdAt ?? runtimeProxyLeases[index2].createdAt,
    expiresAt: patch.expiresAt === void 0 ? runtimeProxyLeases[index2].expiresAt : patch.expiresAt,
    releasedAt: patch.releasedAt === void 0 ? runtimeProxyLeases[index2].releasedAt : patch.releasedAt
  };
  runtimeProxyLeases[index2] = nextRecord;
  return cloneProxyLease(nextRecord);
}
function getRuntimeUsageSummary() {
  if (runtimeUsageRecords.length === 0) {
    return null;
  }
  const newest = runtimeUsageRecords[0];
  const currentPeriod = newest?.periodKey ?? getCurrentPeriodKey();
  const inPeriod = runtimeUsageRecords.filter((record) => record.periodKey === currentPeriod);
  const requests = inPeriod.filter((record) => record.metricType === "request" || record.metricType === "bulk_item").reduce((sum, record) => sum + toNumber(record.quantity), 0);
  const browserRuns = inPeriod.filter((record) => record.metricType === "browser_run").reduce((sum, record) => sum + toNumber(record.quantity), 0);
  const proxyTrafficGb = inPeriod.filter((record) => record.metricType === "proxy_traffic_gb").reduce((sum, record) => sum + toNumber(record.quantity), 0);
  const cogsUsd = inPeriod.reduce((sum, record) => sum + toNumber(record.totalCostUsd), 0);
  const revenueUsd = inPeriod.reduce((sum, record) => {
    const metadata = record.metadataJson;
    return sum + toNumber(metadata?.revenueUsd);
  }, 0);
  const marginUsd = revenueUsd - cogsUsd;
  return {
    currentPeriod,
    requests: Number(requests.toFixed(4)),
    browserRuns: Number(browserRuns.toFixed(4)),
    proxyTrafficGb: Number(proxyTrafficGb.toFixed(4)),
    cogsUsd: Number(cogsUsd.toFixed(4)),
    revenueUsd: Number(revenueUsd.toFixed(4)),
    marginUsd: Number(marginUsd.toFixed(4))
  };
}
function listRuntimeBotTexts() {
  return runtimeBotTexts.slice().sort((a, b) => a.key.localeCompare(b.key)).map(cloneBotText);
}
function saveRuntimeBotText(input) {
  const existingIndex = runtimeBotTexts.findIndex((record2) => record2.key === input.key);
  const record = {
    ...input,
    id: existingIndex >= 0 ? runtimeBotTexts[existingIndex].id : input.id ?? nextRuntimeId(),
    createdAt: existingIndex >= 0 ? runtimeBotTexts[existingIndex].createdAt : input.createdAt
  };
  if (existingIndex >= 0) {
    runtimeBotTexts[existingIndex] = record;
  } else {
    runtimeBotTexts.unshift(record);
  }
  return cloneBotText(record);
}
function listRuntimeBroadcasts() {
  return runtimeBroadcasts.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(cloneBroadcast);
}
function saveRuntimeBroadcast(input) {
  const record = {
    ...input,
    id: input.id ?? nextRuntimeId()
  };
  runtimeBroadcasts.unshift(record);
  return cloneBroadcast(record);
}
function listRuntimeWorkerNodes() {
  return runtimeWorkerNodes.slice().map((node) => ({ ...node, createdAt: new Date(node.createdAt), updatedAt: new Date(node.updatedAt) }));
}
function updateRuntimeWorkerNode(id, patch) {
  const index2 = runtimeWorkerNodes.findIndex((node) => node.id === id);
  if (index2 === -1) return null;
  const nextRecord = {
    ...runtimeWorkerNodes[index2],
    ...patch,
    id: runtimeWorkerNodes[index2].id,
    createdAt: patch.createdAt ?? runtimeWorkerNodes[index2].createdAt,
    updatedAt: /* @__PURE__ */ new Date(),
    lastHeartbeatAt: /* @__PURE__ */ new Date()
  };
  runtimeWorkerNodes[index2] = nextRecord;
  return { ...nextRecord, createdAt: new Date(nextRecord.createdAt), updatedAt: new Date(nextRecord.updatedAt) };
}
function listRuntimeTelegramRecipients() {
  return runtimeTelegramRecipients.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(cloneTelegramRecipient);
}
function saveRuntimeTelegramRecipient(input) {
  const existingIndex = runtimeTelegramRecipients.findIndex((record2) => record2.chatId === input.chatId);
  const record = {
    ...input,
    id: existingIndex >= 0 ? runtimeTelegramRecipients[existingIndex].id : input.id ?? nextRuntimeId(),
    createdAt: existingIndex >= 0 ? runtimeTelegramRecipients[existingIndex].createdAt : input.createdAt
  };
  if (existingIndex >= 0) {
    runtimeTelegramRecipients[existingIndex] = record;
  } else {
    runtimeTelegramRecipients.unshift(record);
  }
  return cloneTelegramRecipient(record);
}
var nextIdCounter, runtimeAdmins, runtimeJobs, runtimeJobEvents, runtimeApiKeys, runtimeAuditTrail, runtimeUsageRecords, runtimeWorkerRuns, runtimeProxyLeases, runtimeBotTexts, runtimeBroadcasts, runtimeTelegramRecipients, runtimeWorkerNodes;
var init_runtimeStore = __esm({
  "server/runtimeStore.ts"() {
    "use strict";
    nextIdCounter = 1;
    runtimeAdmins = [];
    runtimeJobs = [];
    runtimeJobEvents = [];
    runtimeApiKeys = [];
    runtimeAuditTrail = [];
    runtimeUsageRecords = [];
    runtimeWorkerRuns = [];
    runtimeProxyLeases = [];
    runtimeBotTexts = [];
    runtimeBroadcasts = [];
    runtimeTelegramRecipients = [];
    runtimeWorkerNodes = [];
  }
});

// drizzle/schema.ts
import {
  bigint,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var createdAt, updatedAt, users, plans, subscriptions, apiKeys, proxyProviders, proxyPolicies, jobs, jobEvents, workerNodes, workerRuns, proxyLeases, payments, usageRecords, metricSnapshots, telegramEndpoints, auditTrail, systemSettings, apiRateLimits, admins;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    createdAt = timestamp("createdAt").defaultNow().notNull();
    updatedAt = timestamp("updatedAt").defaultNow().onUpdateNow().notNull();
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      telegramChatId: varchar("telegramChatId", { length: 64 }),
      status: mysqlEnum("status", ["active", "suspended", "invited"]).default("active").notNull(),
      createdAt,
      updatedAt,
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    plans = mysqlTable("plans", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 64 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull(),
      tier: mysqlEnum("tier", ["starter", "pro", "vip", "enterprise"]).notNull(),
      billingInterval: mysqlEnum("billingInterval", ["one_time", "monthly", "quarterly", "yearly"]).notNull(),
      currency: varchar("currency", { length: 12 }).default("USD").notNull(),
      priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
      includedRequests: int("includedRequests").default(0).notNull(),
      monthlyApiQuota: int("monthlyApiQuota").default(0).notNull(),
      monthlyBrowserRuns: int("monthlyBrowserRuns").default(0).notNull(),
      maxRpm: int("maxRpm").default(60).notNull(),
      maxConcurrentJobs: int("maxConcurrentJobs").default(1).notNull(),
      vipApiAccess: mysqlEnum("vipApiAccess", ["disabled", "enabled"]).default("disabled").notNull(),
      featuresJson: json("featuresJson"),
      isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
      createdAt,
      updatedAt
    });
    subscriptions = mysqlTable(
      "subscriptions",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        planId: int("planId").notNull(),
        status: mysqlEnum("status", ["pending", "active", "past_due", "canceled", "expired"]).notNull(),
        provider: mysqlEnum("provider", ["manual", "btcpay", "cryptobot"]).notNull(),
        externalRef: varchar("externalRef", { length: 191 }),
        startedAt: timestamp("startedAt"),
        currentPeriodStart: timestamp("currentPeriodStart"),
        currentPeriodEnd: timestamp("currentPeriodEnd"),
        canceledAt: timestamp("canceledAt"),
        metadataJson: json("metadataJson"),
        createdAt,
        updatedAt
      },
      (table) => ({
        subscriptionUserIdx: index("subscriptionUserIdx").on(table.userId),
        subscriptionPlanIdx: index("subscriptionPlanIdx").on(table.planId)
      })
    );
    apiKeys = mysqlTable(
      "apiKeys",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        label: varchar("label", { length: 128 }).notNull(),
        keyPrefix: varchar("keyPrefix", { length: 24 }).notNull(),
        keyHash: varchar("keyHash", { length: 255 }).notNull(),
        scope: mysqlEnum("scope", ["single", "bulk", "vip", "admin"]).notNull(),
        status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
        rpmLimit: int("rpmLimit").default(60).notNull(),
        dailyLimit: int("dailyLimit").default(1e3).notNull(),
        lastUsedAt: timestamp("lastUsedAt"),
        expiresAt: timestamp("expiresAt"),
        createdAt,
        updatedAt
      },
      (table) => ({
        apiKeyUserIdx: index("apiKeyUserIdx").on(table.userId),
        apiKeyPrefixUnique: uniqueIndex("apiKeyPrefixUnique").on(table.keyPrefix)
      })
    );
    proxyProviders = mysqlTable("proxyProviders", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 64 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull(),
      protocolSupport: varchar("protocolSupport", { length: 128 }).notNull(),
      sessionSupport: varchar("sessionSupport", { length: 128 }).notNull(),
      costPerGbUsd: decimal("costPerGbUsd", { precision: 10, scale: 4 }).notNull(),
      priority: int("priority").default(100).notNull(),
      status: mysqlEnum("status", ["healthy", "degraded", "disabled"]).default("healthy").notNull(),
      configJson: json("configJson"),
      notes: text("notes"),
      createdAt,
      updatedAt
    });
    proxyPolicies = mysqlTable(
      "proxyPolicies",
      {
        id: int("id").autoincrement().primaryKey(),
        code: varchar("code", { length: 64 }).notNull().unique(),
        name: varchar("name", { length: 128 }).notNull(),
        protocol: mysqlEnum("protocol", ["http", "socks5"]).notNull(),
        sessionMode: mysqlEnum("sessionMode", ["rotating", "sticky", "hard_sticky"]).notNull(),
        stickyTtlMinutes: int("stickyTtlMinutes"),
        country: varchar("country", { length: 8 }),
        state: varchar("state", { length: 64 }),
        city: varchar("city", { length: 128 }),
        maxTransportRetries: int("maxTransportRetries").default(2).notNull(),
        maxProviderSwitches: int("maxProviderSwitches").default(1).notNull(),
        costCeilingUsd: decimal("costCeilingUsd", { precision: 10, scale: 4 }),
        policyJson: json("policyJson"),
        isDefault: mysqlEnum("isDefault", ["yes", "no"]).default("no").notNull(),
        createdAt,
        updatedAt
      },
      (table) => ({
        proxyPolicyCodeIdx: index("proxyPolicyCodeIdx").on(table.code)
      })
    );
    jobs = mysqlTable(
      "jobs",
      {
        id: int("id").autoincrement().primaryKey(),
        publicId: varchar("publicId", { length: 64 }).notNull().unique(),
        userId: int("userId"),
        apiKeyId: int("apiKeyId"),
        source: mysqlEnum("source", ["dashboard", "api", "telegram", "system", "testbench"]).notNull(),
        requestMode: mysqlEnum("requestMode", ["single", "bulk", "vip"]).notNull(),
        status: mysqlEnum("status", ["queued", "running", "succeeded", "failed", "canceled", "waiting_retry"]).notNull(),
        queueName: varchar("queueName", { length: 64 }).default("default").notNull(),
        priority: int("priority").default(100).notNull(),
        targetLabel: varchar("targetLabel", { length: 191 }),
        payloadJson: json("payloadJson").notNull(),
        resultJson: json("resultJson"),
        errorCode: varchar("errorCode", { length: 64 }),
        errorMessage: text("errorMessage"),
        proxyPolicyId: int("proxyPolicyId"),
        workerNodeId: int("workerNodeId"),
        attemptCount: int("attemptCount").default(0).notNull(),
        maxAttempts: int("maxAttempts").default(3).notNull(),
        costEstimateUsd: decimal("costEstimateUsd", { precision: 10, scale: 4 }).default("0.0000").notNull(),
        cogsUsd: decimal("cogsUsd", { precision: 10, scale: 4 }).default("0.0000").notNull(),
        createdAt,
        updatedAt,
        startedAt: timestamp("startedAt"),
        completedAt: timestamp("completedAt")
      },
      (table) => ({
        jobsUserIdx: index("jobsUserIdx").on(table.userId),
        jobsStatusIdx: index("jobsStatusIdx").on(table.status),
        jobsQueueIdx: index("jobsQueueIdx").on(table.queueName, table.status)
      })
    );
    jobEvents = mysqlTable(
      "jobEvents",
      {
        id: int("id").autoincrement().primaryKey(),
        jobId: int("jobId").notNull(),
        eventType: varchar("eventType", { length: 64 }).notNull(),
        severity: mysqlEnum("severity", ["debug", "info", "warn", "error"]).default("info").notNull(),
        message: text("message").notNull(),
        eventJson: json("eventJson"),
        createdAt
      },
      (table) => ({
        jobEventsJobIdx: index("jobEventsJobIdx").on(table.jobId, table.createdAt)
      })
    );
    workerNodes = mysqlTable("workerNodes", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 64 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull(),
      role: mysqlEnum("role", ["browser", "api", "scheduler", "hybrid"]).default("browser").notNull(),
      status: mysqlEnum("status", ["healthy", "degraded", "offline", "maintenance"]).default("healthy").notNull(),
      concurrencyLimit: int("concurrencyLimit").default(4).notNull(),
      activeJobs: int("activeJobs").default(0).notNull(),
      version: varchar("version", { length: 64 }),
      hostLabel: varchar("hostLabel", { length: 128 }),
      capabilitiesJson: json("capabilitiesJson"),
      lastHeartbeatAt: timestamp("lastHeartbeatAt"),
      createdAt,
      updatedAt
    });
    workerRuns = mysqlTable(
      "workerRuns",
      {
        id: int("id").autoincrement().primaryKey(),
        jobId: int("jobId").notNull(),
        workerNodeId: int("workerNodeId").notNull(),
        runStatus: mysqlEnum("runStatus", ["started", "completed", "failed", "timeout", "canceled"]).notNull(),
        attemptNumber: int("attemptNumber").default(1).notNull(),
        profilePolicy: varchar("profilePolicy", { length: 128 }),
        fingerprintProfile: varchar("fingerprintProfile", { length: 128 }),
        runtimeMs: int("runtimeMs"),
        detailsJson: json("detailsJson"),
        createdAt,
        finishedAt: timestamp("finishedAt")
      },
      (table) => ({
        workerRunsJobIdx: index("workerRunsJobIdx").on(table.jobId),
        workerRunsWorkerIdx: index("workerRunsWorkerIdx").on(table.workerNodeId)
      })
    );
    proxyLeases = mysqlTable(
      "proxyLeases",
      {
        id: int("id").autoincrement().primaryKey(),
        leaseId: varchar("leaseId", { length: 64 }).notNull().unique(),
        jobId: int("jobId"),
        workerNodeId: int("workerNodeId"),
        providerId: int("providerId").notNull(),
        policyId: int("policyId"),
        protocol: mysqlEnum("protocol", ["http", "socks5"]).notNull(),
        sessionMode: mysqlEnum("sessionMode", ["rotating", "sticky", "hard_sticky"]).notNull(),
        sessionKey: varchar("sessionKey", { length: 128 }),
        endpointHost: varchar("endpointHost", { length: 255 }).notNull(),
        endpointPort: int("endpointPort").notNull(),
        country: varchar("country", { length: 8 }),
        status: mysqlEnum("status", ["active", "released", "expired", "failed"]).default("active").notNull(),
        bytesSent: bigint("bytesSent", { mode: "number" }).default(0).notNull(),
        bytesReceived: bigint("bytesReceived", { mode: "number" }).default(0).notNull(),
        estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 4 }).default("0.0000").notNull(),
        lastErrorCode: varchar("lastErrorCode", { length: 64 }),
        metadataJson: json("metadataJson"),
        createdAt,
        expiresAt: timestamp("expiresAt"),
        releasedAt: timestamp("releasedAt")
      },
      (table) => ({
        proxyLeaseJobIdx: index("proxyLeaseJobIdx").on(table.jobId),
        proxyLeaseProviderIdx: index("proxyLeaseProviderIdx").on(table.providerId, table.status)
      })
    );
    payments = mysqlTable(
      "payments",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId").notNull(),
        subscriptionId: int("subscriptionId"),
        provider: mysqlEnum("provider", ["btcpay", "cryptobot", "manual"]).notNull(),
        status: mysqlEnum("status", ["pending", "paid", "confirmed", "expired", "failed", "refunded"]).notNull(),
        currency: varchar("currency", { length: 16 }).notNull(),
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
        amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }),
        txRef: varchar("txRef", { length: 191 }),
        invoiceRef: varchar("invoiceRef", { length: 191 }),
        metadataJson: json("metadataJson"),
        createdAt,
        updatedAt,
        paidAt: timestamp("paidAt")
      },
      (table) => ({
        paymentsUserIdx: index("paymentsUserIdx").on(table.userId),
        paymentsStatusIdx: index("paymentsStatusIdx").on(table.status)
      })
    );
    usageRecords = mysqlTable(
      "usageRecords",
      {
        id: int("id").autoincrement().primaryKey(),
        userId: int("userId"),
        apiKeyId: int("apiKeyId"),
        jobId: int("jobId"),
        metricType: mysqlEnum("metricType", ["request", "bulk_item", "browser_run", "proxy_traffic_gb", "captcha", "storage"]).notNull(),
        quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
        unitCostUsd: decimal("unitCostUsd", { precision: 10, scale: 4 }).default("0.0000").notNull(),
        totalCostUsd: decimal("totalCostUsd", { precision: 12, scale: 4 }).default("0.0000").notNull(),
        periodKey: varchar("periodKey", { length: 32 }).notNull(),
        metadataJson: json("metadataJson"),
        createdAt
      },
      (table) => ({
        usageUserIdx: index("usageUserIdx").on(table.userId, table.periodKey),
        usageApiKeyIdx: index("usageApiKeyIdx").on(table.apiKeyId, table.periodKey)
      })
    );
    metricSnapshots = mysqlTable(
      "metricSnapshots",
      {
        id: int("id").autoincrement().primaryKey(),
        snapshotType: mysqlEnum("snapshotType", ["system", "provider", "queue", "billing", "job"]).notNull(),
        scopeKey: varchar("scopeKey", { length: 128 }).notNull(),
        successRate: decimal("successRate", { precision: 7, scale: 4 }),
        errorRate: decimal("errorRate", { precision: 7, scale: 4 }),
        queueDepth: int("queueDepth"),
        activeWorkers: int("activeWorkers"),
        cogsUsd: decimal("cogsUsd", { precision: 12, scale: 4 }),
        revenueUsd: decimal("revenueUsd", { precision: 12, scale: 4 }),
        payloadJson: json("payloadJson"),
        createdAt
      },
      (table) => ({
        metricTypeScopeIdx: index("metricTypeScopeIdx").on(table.snapshotType, table.scopeKey, table.createdAt)
      })
    );
    telegramEndpoints = mysqlTable("telegramEndpoints", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      botLabel: varchar("botLabel", { length: 128 }).notNull(),
      chatId: varchar("chatId", { length: 64 }),
      status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
      commandScope: varchar("commandScope", { length: 128 }).default("owner_alerts").notNull(),
      metadataJson: json("metadataJson"),
      createdAt,
      updatedAt
    });
    auditTrail = mysqlTable(
      "auditTrail",
      {
        id: int("id").autoincrement().primaryKey(),
        actorUserId: int("actorUserId"),
        actorType: mysqlEnum("actorType", ["user", "system", "worker", "api_key"]).notNull(),
        action: varchar("action", { length: 128 }).notNull(),
        resourceType: varchar("resourceType", { length: 64 }).notNull(),
        resourceId: varchar("resourceId", { length: 128 }).notNull(),
        status: mysqlEnum("status", ["success", "failure", "denied"]).notNull(),
        ipAddress: varchar("ipAddress", { length: 64 }),
        detailsJson: json("detailsJson"),
        createdAt
      },
      (table) => ({
        auditResourceIdx: index("auditResourceIdx").on(table.resourceType, table.resourceId, table.createdAt),
        auditActorIdx: index("auditActorIdx").on(table.actorUserId, table.createdAt)
      })
    );
    systemSettings = mysqlTable("systemSettings", {
      id: int("id").autoincrement().primaryKey(),
      category: varchar("category", { length: 64 }).notNull(),
      settingKey: varchar("settingKey", { length: 128 }).notNull(),
      valueJson: json("valueJson"),
      updatedByUserId: int("updatedByUserId"),
      createdAt,
      updatedAt
    });
    apiRateLimits = mysqlTable(
      "api_rate_limits",
      {
        id: int("id").autoincrement().primaryKey(),
        keyPrefix: varchar("key_prefix", { length: 32 }).notNull(),
        windowKey: varchar("window_key", { length: 32 }).notNull(),
        // "2026-05-16-15-30" for minute, "2026-05-16" for daily
        windowType: mysqlEnum("window_type", ["minute", "daily"]).notNull(),
        hits: int("hits").notNull().default(1),
        createdAt,
        updatedAt
      },
      (table) => ({
        apiRateLimitsUnique: uniqueIndex("apiRateLimitsUnique").on(table.keyPrefix, table.windowType, table.windowKey),
        apiRateLimitsKeyMinute: index("apiRateLimitsKeyMinute").on(table.keyPrefix, table.windowKey)
      })
    );
    admins = mysqlTable("admins", {
      id: int("id").autoincrement().primaryKey(),
      username: varchar("username", { length: 64 }).notNull().unique(),
      passwordHash: varchar("password_hash", { length: 255 }).notNull(),
      role: varchar("role", { length: 16 }).notNull().default("admin"),
      createdAt: timestamp("created_at").defaultNow()
    });
  }
});

// server/platformMockData.ts
function getMockDashboardSummary() {
  return {
    metrics: MOCK_METRIC_CARDS,
    jobs: MOCK_JOBS,
    providers: MOCK_PROXY_PROVIDERS,
    workers: MOCK_WORKER_NODES,
    usage: MOCK_USAGE_SUMMARY,
    safeTestScenarios: SAFE_TEST_SCENARIOS,
    health: MOCK_HEALTH_SUMMARY
  };
}
function findMockJob(publicId) {
  return MOCK_JOBS.find((job) => job.publicId === publicId) ?? null;
}
function listMockJobEvents(jobId) {
  return MOCK_JOB_EVENTS.filter((event) => event.jobId === jobId).map((event) => ({
    ...event,
    createdAt: new Date(event.createdAt)
  })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
function listMockAuditTrail() {
  return MOCK_AUDIT_TRAIL.map((entry) => ({
    id: entry.id,
    actorUserId: entry.actorUserId ?? null,
    actorType: entry.actorType,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    status: entry.status,
    ipAddress: entry.ipAddress ?? null,
    detailsJson: entry.detailsJson,
    createdAt: new Date(entry.createdAt)
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
var MOCK_PLANS, MOCK_PROXY_PROVIDERS, MOCK_PROXY_POLICIES, MOCK_WORKER_NODES, MOCK_JOBS, MOCK_JOB_EVENTS, MOCK_AUDIT_TRAIL, MOCK_METRIC_CARDS, MOCK_USAGE_SUMMARY, MOCK_HEALTH_SUMMARY, MOCK_API_KEYS, MOCK_SUBSCRIPTIONS, MOCK_PAYMENTS;
var init_platformMockData = __esm({
  "server/platformMockData.ts"() {
    "use strict";
    init_platform();
    MOCK_PLANS = [
      {
        id: 1,
        code: "starter-monthly",
        name: "Starter Monthly",
        tier: "starter",
        billingInterval: "monthly",
        currency: "USD",
        priceUsd: "49.00",
        includedRequests: 500,
        monthlyApiQuota: 500,
        monthlyBrowserRuns: 100,
        maxRpm: 30,
        maxConcurrentJobs: 1,
        vipApiAccess: "disabled",
        featuresJson: ["single-api", "dashboard", "basic-metrics"],
        isActive: "yes"
      },
      {
        id: 2,
        code: "vip-monthly",
        name: "VIP Monthly",
        tier: "vip",
        billingInterval: "monthly",
        currency: "USD",
        priceUsd: "299.00",
        includedRequests: 1e4,
        monthlyApiQuota: 1e4,
        monthlyBrowserRuns: 2500,
        maxRpm: 300,
        maxConcurrentJobs: 8,
        vipApiAccess: "enabled",
        featuresJson: ["single-api", "bulk-api", "vip-api", "priority-queue", "advanced-metrics"],
        isActive: "yes"
      }
    ];
    MOCK_PROXY_PROVIDERS = [
      {
        id: 1,
        code: "evomi",
        name: "Evomi",
        protocolSupport: "http,socks5",
        sessionSupport: "rotating,sticky",
        costPerGbUsd: "2.4900",
        priority: 100,
        status: "healthy",
        notes: "Primary residential provider for default policy.",
        configJson: {
          supportsSticky: true,
          supportsRotating: true,
          supportsCountryRouting: true,
          defaultProtocol: "http"
        }
      },
      {
        id: 2,
        code: "dataimpulse",
        name: "DataImpulse",
        protocolSupport: "http,socks5",
        sessionSupport: "rotating,sticky",
        costPerGbUsd: "1.0000",
        priority: 120,
        status: "healthy",
        notes: "Lower-cost fallback provider for failover and cost optimization.",
        configJson: {
          supportsSticky: true,
          supportsRotating: true,
          supportsCountryRouting: true,
          defaultProtocol: "http"
        }
      }
    ];
    MOCK_PROXY_POLICIES = [
      {
        id: 1,
        code: "default-rotating",
        name: "Default Rotating",
        protocol: "http",
        sessionMode: "rotating",
        stickyTtlMinutes: null,
        country: null,
        state: null,
        city: null,
        maxTransportRetries: 2,
        maxProviderSwitches: 1,
        costCeilingUsd: "0.5000",
        isDefault: "yes",
        policyJson: {
          providerOrder: ["evomi", "dataimpulse"],
          enableFallback: true,
          safeForBulk: true
        }
      },
      {
        id: 2,
        code: "vip-sticky",
        name: "VIP Sticky 30m",
        protocol: "http",
        sessionMode: "sticky",
        stickyTtlMinutes: 30,
        country: "us",
        state: null,
        city: null,
        maxTransportRetries: 3,
        maxProviderSwitches: 2,
        costCeilingUsd: "2.0000",
        isDefault: "no",
        policyJson: {
          providerOrder: ["evomi", "dataimpulse"],
          enableFallback: true,
          sessionReuse: true
        }
      }
    ];
    MOCK_WORKER_NODES = [
      {
        id: 1,
        code: "worker-browser-a",
        name: "Browser Worker A",
        role: "browser",
        status: "healthy",
        concurrencyLimit: 4,
        activeJobs: 2,
        version: "0.1.0",
        hostLabel: "sandbox-local-a",
        lastHeartbeatAt: Date.now() - 15e3,
        capabilitiesJson: {
          safeTestBench: true,
          browserAutomation: true,
          camoufoxProfileMode: "simulated"
        }
      },
      {
        id: 2,
        code: "worker-api-b",
        name: "API Worker B",
        role: "hybrid",
        status: "healthy",
        concurrencyLimit: 8,
        activeJobs: 3,
        version: "0.1.0",
        hostLabel: "sandbox-local-b",
        lastHeartbeatAt: Date.now() - 8e3,
        capabilitiesJson: {
          safeTestBench: true,
          browserAutomation: false,
          apiBatching: true
        }
      }
    ];
    MOCK_JOBS = [
      {
        id: 1,
        publicId: "job_mock_success_001",
        userId: 1,
        apiKeyId: 1,
        source: "dashboard",
        requestMode: "single",
        status: "succeeded",
        queueName: "default",
        priority: 100,
        targetLabel: "mock://catalog/item/42",
        payloadJson: { target: "mock://catalog/item/42", action: "extract", safe: true },
        resultJson: {
          title: "Mock Catalog Item",
          price: 199.99,
          currency: "USD",
          oneCsResult: {
            creditScore: 742,
            productScore: 16,
            dataQualityScore: 8.5,
            adverseReasons: ["RiskView Consumer Inquiry"],
            adverseReasonGroups: ["inquiry_pressure"],
            status: "success",
            priceUsd: 1.9,
            durationMs: 18420,
            source: "dashboard",
            explanations: [
              "Raw credit score 742 mapped to product score 16/20.",
              "Record completeness contributed 86% of the available lead signals.",
              "Recent inquiry pressure added a smaller negative adjustment.",
              "Final status: success, data quality 8.5/10."
            ],
            completenessScore: 0.86
          },
          summary: {
            creditScore: 742,
            productScore: 16,
            dataQualityScore: 8.5,
            status: "success",
            adverseReasonCount: 1
          }
        },
        errorCode: null,
        errorMessage: null,
        proxyPolicyId: 1,
        workerNodeId: 1,
        attemptCount: 1,
        maxAttempts: 3,
        costEstimateUsd: "0.0200",
        cogsUsd: "0.0110",
        createdAt: Date.now() - 36e5,
        startedAt: Date.now() - 354e4,
        completedAt: Date.now() - 352e4
      },
      {
        id: 2,
        publicId: "job_mock_retry_002",
        userId: 1,
        apiKeyId: 1,
        source: "api",
        requestMode: "bulk",
        status: "waiting_retry",
        queueName: "bulk",
        priority: 120,
        targetLabel: "mock://retry/case",
        payloadJson: { target: "mock://retry/case", action: "extract", simulateRetryableError: true },
        resultJson: {
          oneCsResult: {
            creditScore: 611,
            productScore: 12,
            dataQualityScore: 3.5,
            adverseReasons: [
              "Income or credit history insufficient for loan",
              "Requested amount unsupported by income",
              "Too many accounts with balances"
            ],
            adverseReasonGroups: ["affordability", "utilization"],
            status: "decline",
            priceUsd: 1.7,
            durationMs: 26340,
            source: "api",
            explanations: [
              "Raw credit score 611 mapped to product score 12/20.",
              "Record completeness contributed 71% of the available lead signals.",
              "Income and debt affordability signals indicate lower financing readiness.",
              "High utilization or too many balances reduced quality despite other available signals.",
              "Final status: decline, data quality 3.5/10."
            ],
            completenessScore: 0.71
          },
          summary: {
            creditScore: 611,
            productScore: 12,
            dataQualityScore: 3.5,
            status: "decline",
            adverseReasonCount: 3
          }
        },
        errorCode: "TRANSPORT_TIMEOUT",
        errorMessage: "First attempt timed out in safe test mode.",
        proxyPolicyId: 1,
        workerNodeId: 2,
        attemptCount: 1,
        maxAttempts: 3,
        costEstimateUsd: "0.1400",
        cogsUsd: "0.0320",
        createdAt: Date.now() - 18e5,
        startedAt: Date.now() - 179e4,
        completedAt: null
      },
      {
        id: 3,
        publicId: "job_mock_vip_003",
        userId: 1,
        apiKeyId: 2,
        source: "testbench",
        requestMode: "vip",
        status: "running",
        queueName: "vip",
        priority: 10,
        targetLabel: "mock://provider/fallback",
        payloadJson: { target: "mock://provider/fallback", action: "extract", simulateProviderFailure: true },
        resultJson: {
          oneCsResult: {
            creditScore: 458,
            productScore: 6,
            dataQualityScore: 1,
            adverseReasons: [
              "Serious delinquency, and public record or collection filed",
              "High debt in relation to income"
            ],
            adverseReasonGroups: ["public_record", "affordability"],
            status: "decline",
            priceUsd: 2.5,
            durationMs: 28750,
            source: "testbench",
            explanations: [
              "Raw credit score 458 mapped to product score 6/20.",
              "Public record or collection signals materially reduced data quality.",
              "Income and debt affordability signals indicate lower financing readiness.",
              "Final status: decline, data quality 1/10."
            ],
            completenessScore: 0.63
          },
          summary: {
            creditScore: 458,
            productScore: 6,
            dataQualityScore: 1,
            status: "decline",
            adverseReasonCount: 2
          }
        },
        errorCode: null,
        errorMessage: null,
        proxyPolicyId: 2,
        workerNodeId: 1,
        attemptCount: 1,
        maxAttempts: 4,
        costEstimateUsd: "0.3800",
        cogsUsd: "0.0900",
        createdAt: Date.now() - 6e5,
        startedAt: Date.now() - 58e4,
        completedAt: null
      }
    ];
    MOCK_JOB_EVENTS = [
      {
        id: 1,
        jobId: 1,
        eventType: "job.created",
        severity: "info",
        message: "Safe test job created from dashboard.",
        eventJson: { source: "dashboard" },
        createdAt: Date.now() - 36e5
      },
      {
        id: 2,
        jobId: 1,
        eventType: "worker.completed",
        severity: "info",
        message: "Worker finished safe extraction flow.",
        eventJson: { runtimeMs: 2e4, proxyProvider: "evomi" },
        createdAt: Date.now() - 352e4
      },
      {
        id: 3,
        jobId: 2,
        eventType: "proxy.transport_timeout",
        severity: "warn",
        message: "Retryable transport timeout detected on first attempt.",
        eventJson: { provider: "evomi", retryable: true },
        createdAt: Date.now() - 178e4
      },
      {
        id: 4,
        jobId: 2,
        eventType: "job.waiting_retry",
        severity: "warn",
        message: "Job returned to queue with exponential backoff.",
        eventJson: { backoffMs: 3e4 },
        createdAt: Date.now() - 1775e3
      },
      {
        id: 5,
        jobId: 3,
        eventType: "proxy.provider_fallback",
        severity: "warn",
        message: "Primary provider degraded, fallback lease simulation activated.",
        eventJson: { from: "evomi", to: "dataimpulse" },
        createdAt: Date.now() - 56e4
      }
    ];
    MOCK_AUDIT_TRAIL = [
      {
        id: 1,
        actorUserId: 1,
        actorType: "user",
        action: "job.create",
        resourceType: "job",
        resourceId: "job_mock_success_001",
        status: "success",
        ipAddress: "127.0.0.1",
        detailsJson: { mode: "single", source: "dashboard" },
        createdAt: Date.now() - 36e5
      },
      {
        id: 2,
        actorUserId: 1,
        actorType: "user",
        action: "apikey.create",
        resourceType: "api_key",
        resourceId: "key_mock_vip_002",
        status: "success",
        ipAddress: "127.0.0.1",
        detailsJson: { scope: "vip" },
        createdAt: Date.now() - 72e5
      },
      {
        id: 3,
        actorUserId: null,
        actorType: "system",
        action: "proxy.fallback",
        resourceType: "job",
        resourceId: "job_mock_vip_003",
        status: "success",
        ipAddress: null,
        detailsJson: { from: "evomi", to: "dataimpulse" },
        createdAt: Date.now() - 56e4
      }
    ];
    MOCK_METRIC_CARDS = [
      {
        key: "success_rate",
        title: "Success Rate",
        value: "98.4%",
        delta: "+1.2% vs 24h",
        status: "good"
      },
      {
        key: "queue_depth",
        title: "Queue Depth",
        value: "12",
        delta: "3 VIP / 4 bulk / 5 default",
        status: "neutral"
      },
      {
        key: "proxy_cogs",
        title: "Proxy COGS",
        value: "$184.42",
        delta: "-6.8% vs 24h",
        status: "good"
      },
      {
        key: "transport_errors",
        title: "Transport Errors",
        value: "7",
        delta: "2 retryable / 5 resolved",
        status: "warn"
      }
    ];
    MOCK_USAGE_SUMMARY = {
      currentPeriod: "2026-04",
      requests: 6240,
      browserRuns: 980,
      proxyTrafficGb: 182.42,
      cogsUsd: 184.42,
      revenueUsd: 622.15,
      marginUsd: 437.73
    };
    MOCK_HEALTH_SUMMARY = {
      status: "healthy",
      queues: {
        default: { depth: 5, lagSeconds: 12 },
        bulk: { depth: 4, lagSeconds: 28 },
        vip: { depth: 3, lagSeconds: 6 }
      },
      providers: {
        evomi: { status: "healthy", successRate: 0.981, avgLeaseMs: 320 },
        dataimpulse: { status: "healthy", successRate: 0.974, avgLeaseMs: 410 }
      },
      workers: {
        total: MOCK_WORKER_NODES.length,
        healthy: MOCK_WORKER_NODES.filter((worker) => worker.status === "healthy").length
      }
    };
    MOCK_API_KEYS = [
      {
        id: 1,
        userId: 1,
        label: "Primary Single/Bulk Key",
        keyPrefix: "cs_live_01",
        scope: "bulk",
        status: "active",
        rpmLimit: 120,
        dailyLimit: 5e3,
        lastUsedAt: Date.now() - 3e5,
        expiresAt: null
      },
      {
        id: 2,
        userId: 1,
        label: "VIP Partner Key",
        keyPrefix: "cs_vip_02",
        scope: "vip",
        status: "active",
        rpmLimit: 300,
        dailyLimit: 25e3,
        lastUsedAt: Date.now() - 45e3,
        expiresAt: null
      }
    ];
    MOCK_SUBSCRIPTIONS = [
      {
        id: 1,
        userId: 1,
        planId: 2,
        status: "active",
        provider: "manual",
        externalRef: "sub_mock_001",
        startedAt: Date.now() - 20 * 24 * 60 * 60 * 1e3,
        currentPeriodStart: Date.now() - 2 * 24 * 60 * 60 * 1e3,
        currentPeriodEnd: Date.now() + 28 * 24 * 60 * 60 * 1e3
      }
    ];
    MOCK_PAYMENTS = [
      {
        id: 1,
        userId: 1,
        subscriptionId: 1,
        provider: "manual",
        status: "confirmed",
        currency: "USD",
        amount: "299.00",
        amountUsd: "299.00",
        txRef: "manual-recon-001",
        invoiceRef: "vip-monthly-2026-04",
        paidAt: Date.now() - 2 * 24 * 60 * 60 * 1e3
      }
    ];
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  findApiKeyAuthRecordByHash: () => findApiKeyAuthRecordByHash,
  getAdminByUsername: () => getAdminByUsername,
  getDailyHits: () => getDailyHits,
  getDashboardSummary: () => getDashboardSummary,
  getDb: () => getDb,
  getJobByPublicId: () => getJobByPublicId,
  getRateLimitHits: () => getRateLimitHits,
  getUserByOpenId: () => getUserByOpenId,
  incrementDailyHits: () => incrementDailyHits,
  incrementRateLimitHits: () => incrementRateLimitHits,
  listApiKeysForUser: () => listApiKeysForUser,
  listAuditTrailEntries: () => listAuditTrailEntries,
  listBotTextSettings: () => listBotTextSettings,
  listJobEventsByJobId: () => listJobEventsByJobId,
  listJobs: () => listJobs,
  listMetricSnapshots: () => listMetricSnapshots,
  listPayments: () => listPayments,
  listPlans: () => listPlans,
  listProxyPolicies: () => listProxyPolicies,
  listProxyProviders: () => listProxyProviders,
  listSubscriptions: () => listSubscriptions,
  listTelegramRecipients: () => listTelegramRecipients,
  listWorkerNodes: () => listWorkerNodes,
  persistApiKeyRecord: () => persistApiKeyRecord,
  persistAuditTrailEntry: () => persistAuditTrailEntry,
  persistJobEvents: () => persistJobEvents,
  persistJobRecord: () => persistJobRecord,
  persistProxyLease: () => persistProxyLease,
  persistUsageRecord: () => persistUsageRecord,
  persistWorkerRun: () => persistWorkerRun,
  revokeApiKeyRecord: () => revokeApiKeyRecord,
  touchApiKeyLastUsed: () => touchApiKeyLastUsed,
  updateJobRecord: () => updateJobRecord,
  updateWorkerNodeHeartbeat: () => updateWorkerNodeHeartbeat,
  upsertAdmin: () => upsertAdmin,
  upsertBotTextSetting: () => upsertBotTextSetting,
  upsertUser: () => upsertUser
});
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to initialize drizzle:", error);
      _db = null;
    }
  }
  if (_db) {
    try {
      await _db.execute(sql`SELECT 1`);
    } catch {
      console.warn("[Database] Connection test failed, treating DB as unavailable");
      _db = null;
    }
  }
  return _db;
}
async function withMockFallback(label, runQuery, getFallback) {
  const db = await getDb();
  if (!db) {
    return getFallback();
  }
  try {
    return await runQuery(db);
  } catch (error) {
    console.warn(`[Database] ${label} failed, using mock fallback`, error);
    return await getFallback();
  }
}
async function getAdminByUsername(username) {
  const db = await getDb();
  if (!db) {
    const runtimeAdmin = getRuntimeAdminByUsername(username);
    if (runtimeAdmin) {
      return runtimeAdmin;
    }
    if (username === ENV.adminUsername && ENV.adminPasswordHash.length > 0) {
      return {
        id: 0,
        username: ENV.adminUsername,
        passwordHash: ENV.adminPasswordHash,
        role: "admin",
        createdAt: /* @__PURE__ */ new Date()
      };
    }
    return null;
  }
  try {
    const result = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.warn("[Database] getAdminByUsername failed", error);
    return null;
  }
}
async function upsertAdmin(username, passwordHash, role = "admin") {
  const db = await getDb();
  if (!db) {
    return saveRuntimeAdmin({ username, passwordHash, role, createdAt: /* @__PURE__ */ new Date() });
  }
  try {
    await db.insert(admins).values({ username, passwordHash, role }).onDuplicateKeyUpdate({
      set: { passwordHash, role }
    });
    const result = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
    if (result.length === 0) {
      throw new Error(`Admin ${username} not found after upsert`);
    }
    return result[0];
  } catch (error) {
    console.warn("[Database] upsertAdmin failed, falling back to runtimeStore", error);
    const existing = getRuntimeAdminByUsername(username);
    if (existing) return existing;
    return saveRuntimeAdmin({ username, passwordHash, role, createdAt: /* @__PURE__ */ new Date() });
  }
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available, using mock-safe mode");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod", "telegramChatId", "status"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  return withMockFallback(
    "getUserByOpenId",
    async (db) => {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result.length > 0 ? result[0] : void 0;
    },
    () => ({
      id: 1,
      openId,
      email: "owner@example.com",
      name: "User",
      loginMethod: "local",
      role: "user",
      telegramChatId: null,
      status: "active",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      lastSignedIn: /* @__PURE__ */ new Date()
    })
  );
}
async function getDashboardSummary() {
  const mock = getMockDashboardSummary();
  const runtimeUsage = getRuntimeUsageSummary();
  return {
    metrics: mock.metrics,
    jobs: (await listJobs()).slice(0, 10),
    providers: await listProxyProviders(),
    workers: await listWorkerNodes(),
    plans: await listPlans(),
    usage: runtimeUsage ?? mock.usage,
    safeTestScenarios: mock.safeTestScenarios,
    health: mock.health
  };
}
async function listJobs() {
  return withMockFallback(
    "listJobs",
    async (db) => {
      const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100);
      return rows.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        userId: row.userId ?? null,
        apiKeyId: row.apiKeyId ?? null,
        source: String(row.source),
        requestMode: String(row.requestMode),
        status: String(row.status),
        queueName: row.queueName,
        priority: row.priority,
        targetLabel: row.targetLabel,
        payloadJson: row.payloadJson,
        resultJson: row.resultJson,
        errorCode: row.errorCode ?? null,
        errorMessage: row.errorMessage ?? null,
        proxyPolicyId: row.proxyPolicyId ?? null,
        workerNodeId: row.workerNodeId ?? null,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        costEstimateUsd: row.costEstimateUsd ? String(row.costEstimateUsd) : null,
        cogsUsd: row.cogsUsd ? String(row.cogsUsd) : null,
        createdAt: row.createdAt,
        startedAt: row.startedAt ?? null,
        completedAt: row.completedAt ?? null
      }));
    },
    () => {
      const runtimeJobs2 = listRuntimeJobs();
      if (runtimeJobs2.length > 0) {
        return runtimeJobs2;
      }
      return [...MOCK_JOBS].sort((a, b) => b.createdAt - a.createdAt).map((row) => ({
        id: row.id,
        publicId: row.publicId,
        userId: row.userId ?? null,
        apiKeyId: row.apiKeyId ?? null,
        source: String(row.source),
        requestMode: String(row.requestMode),
        status: String(row.status),
        queueName: row.queueName,
        priority: row.priority,
        targetLabel: row.targetLabel,
        payloadJson: row.payloadJson,
        resultJson: row.resultJson,
        errorCode: row.errorCode ?? null,
        errorMessage: row.errorMessage ?? null,
        proxyPolicyId: row.proxyPolicyId ?? null,
        workerNodeId: row.workerNodeId ?? null,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        costEstimateUsd: row.costEstimateUsd ?? null,
        cogsUsd: row.cogsUsd ?? null,
        createdAt: new Date(row.createdAt),
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
        completedAt: row.completedAt ? new Date(row.completedAt) : null
      }));
    }
  );
}
async function getJobByPublicId(publicId) {
  return withMockFallback(
    "getJobByPublicId",
    async (db) => {
      const result = await db.select().from(jobs).where(eq(jobs.publicId, publicId)).limit(1);
      const row = result[0];
      if (!row) return null;
      return {
        id: row.id,
        publicId: row.publicId,
        userId: row.userId ?? null,
        apiKeyId: row.apiKeyId ?? null,
        source: String(row.source),
        requestMode: String(row.requestMode),
        status: String(row.status),
        queueName: row.queueName,
        priority: row.priority,
        targetLabel: row.targetLabel,
        payloadJson: row.payloadJson,
        resultJson: row.resultJson,
        errorCode: row.errorCode ?? null,
        errorMessage: row.errorMessage ?? null,
        proxyPolicyId: row.proxyPolicyId ?? null,
        workerNodeId: row.workerNodeId ?? null,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        costEstimateUsd: row.costEstimateUsd ? String(row.costEstimateUsd) : null,
        cogsUsd: row.cogsUsd ? String(row.cogsUsd) : null,
        createdAt: row.createdAt,
        startedAt: row.startedAt ?? null,
        completedAt: row.completedAt ?? null
      };
    },
    () => {
      const runtimeJob = findRuntimeJob(publicId);
      if (runtimeJob) {
        return runtimeJob;
      }
      const row = findMockJob(publicId);
      if (!row) return null;
      return {
        id: row.id,
        publicId: row.publicId,
        userId: row.userId ?? null,
        apiKeyId: row.apiKeyId ?? null,
        source: String(row.source),
        requestMode: String(row.requestMode),
        status: String(row.status),
        queueName: row.queueName,
        priority: row.priority,
        targetLabel: row.targetLabel,
        payloadJson: row.payloadJson,
        resultJson: row.resultJson,
        errorCode: row.errorCode ?? null,
        errorMessage: row.errorMessage ?? null,
        proxyPolicyId: row.proxyPolicyId ?? null,
        workerNodeId: row.workerNodeId ?? null,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        costEstimateUsd: row.costEstimateUsd ?? null,
        cogsUsd: row.cogsUsd ?? null,
        createdAt: new Date(row.createdAt),
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
        completedAt: row.completedAt ? new Date(row.completedAt) : null
      };
    }
  );
}
async function listJobEventsByJobId(jobId) {
  return withMockFallback(
    "listJobEventsByJobId",
    async (db) => {
      const rows = await db.select().from(jobEvents).where(eq(jobEvents.jobId, jobId)).orderBy(desc(jobEvents.createdAt)).limit(100);
      return rows.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        eventType: row.eventType,
        severity: String(row.severity),
        message: row.message,
        eventJson: row.eventJson,
        createdAt: row.createdAt
      }));
    },
    () => {
      const runtimeEvents = listRuntimeJobEventsByJobId(jobId);
      if (runtimeEvents.length > 0) {
        return runtimeEvents;
      }
      return listMockJobEvents(jobId).map((row) => ({
        id: row.id,
        jobId: row.jobId,
        eventType: row.eventType,
        severity: String(row.severity),
        message: row.message,
        eventJson: row.eventJson,
        createdAt: row.createdAt
      }));
    }
  );
}
async function listProxyProviders() {
  return withMockFallback(
    "listProxyProviders",
    async (db) => {
      const rows = await db.select().from(proxyProviders).orderBy(proxyProviders.priority);
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        protocolSupport: row.protocolSupport,
        sessionSupport: row.sessionSupport,
        costPerGbUsd: String(row.costPerGbUsd),
        priority: row.priority,
        status: String(row.status),
        notes: row.notes ?? null,
        configJson: row.configJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => [...MOCK_PROXY_PROVIDERS].sort((a, b) => a.priority - b.priority).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      protocolSupport: row.protocolSupport,
      sessionSupport: row.sessionSupport,
      costPerGbUsd: row.costPerGbUsd,
      priority: row.priority,
      status: String(row.status),
      notes: row.notes ?? null,
      configJson: row.configJson
    }))
  );
}
async function listProxyPolicies() {
  return withMockFallback(
    "listProxyPolicies",
    async (db) => {
      const rows = await db.select().from(proxyPolicies).orderBy(desc(proxyPolicies.isDefault), proxyPolicies.name);
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        protocol: String(row.protocol),
        sessionMode: String(row.sessionMode),
        stickyTtlMinutes: row.stickyTtlMinutes ?? null,
        country: row.country ?? null,
        state: row.state ?? null,
        city: row.city ?? null,
        maxTransportRetries: row.maxTransportRetries,
        maxProviderSwitches: row.maxProviderSwitches,
        costCeilingUsd: String(row.costCeilingUsd),
        isDefault: String(row.isDefault),
        policyJson: row.policyJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => [...MOCK_PROXY_POLICIES].map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      protocol: String(row.protocol),
      sessionMode: String(row.sessionMode),
      stickyTtlMinutes: row.stickyTtlMinutes ?? null,
      country: row.country ?? null,
      state: row.state ?? null,
      city: row.city ?? null,
      maxTransportRetries: row.maxTransportRetries,
      maxProviderSwitches: row.maxProviderSwitches,
      costCeilingUsd: row.costCeilingUsd,
      isDefault: String(row.isDefault),
      policyJson: row.policyJson
    }))
  );
}
async function listWorkerNodes() {
  return withMockFallback(
    "listWorkerNodes",
    async (db) => {
      const rows = await db.select().from(workerNodes).orderBy(workerNodes.name);
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        role: String(row.role),
        status: String(row.status),
        concurrencyLimit: row.concurrencyLimit,
        activeJobs: row.activeJobs,
        version: row.version ?? null,
        hostLabel: row.hostLabel ?? null,
        capabilitiesJson: row.capabilitiesJson,
        lastHeartbeatAt: row.lastHeartbeatAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => [...MOCK_WORKER_NODES].map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      role: String(row.role),
      status: String(row.status),
      concurrencyLimit: row.concurrencyLimit,
      activeJobs: row.activeJobs,
      version: row.version ?? null,
      hostLabel: row.hostLabel ?? null,
      capabilitiesJson: row.capabilitiesJson,
      lastHeartbeatAt: new Date(row.lastHeartbeatAt)
    }))
  );
}
async function listApiKeysForUser(userId) {
  return withMockFallback(
    "listApiKeysForUser",
    async (db) => {
      const rows = !userId ? await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)).limit(100) : await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt)).limit(100);
      const databaseKeys = rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        label: row.label,
        keyPrefix: row.keyPrefix,
        scope: String(row.scope),
        status: String(row.status),
        rpmLimit: row.rpmLimit,
        dailyLimit: row.dailyLimit,
        lastUsedAt: row.lastUsedAt ?? null,
        expiresAt: row.expiresAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
      const runtimeKeys = listRuntimeApiKeys(userId).map((row) => ({
        id: row.id,
        userId: row.userId,
        label: row.label,
        keyPrefix: row.keyPrefix,
        scope: String(row.scope),
        status: String(row.status),
        rpmLimit: row.rpmLimit,
        dailyLimit: row.dailyLimit,
        lastUsedAt: row.lastUsedAt ?? null,
        expiresAt: row.expiresAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
      const merged = [...runtimeKeys, ...databaseKeys];
      const seen = /* @__PURE__ */ new Set();
      return merged.filter((row) => {
        if (seen.has(row.keyPrefix)) {
          return false;
        }
        seen.add(row.keyPrefix);
        return true;
      });
    },
    () => {
      const runtimeApiKeys2 = listRuntimeApiKeys(userId);
      if (runtimeApiKeys2.length > 0) {
        return runtimeApiKeys2;
      }
      return (userId ? MOCK_API_KEYS.filter((key) => key.userId === userId) : [...MOCK_API_KEYS]).map((row) => ({
        id: row.id,
        userId: row.userId,
        label: row.label,
        keyPrefix: row.keyPrefix,
        scope: String(row.scope),
        status: String(row.status),
        rpmLimit: row.rpmLimit,
        dailyLimit: row.dailyLimit,
        lastUsedAt: new Date(row.lastUsedAt),
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : null
      }));
    }
  );
}
async function findApiKeyAuthRecordByHash(keyHash) {
  const db = await getDb();
  if (!db) {
    const runtimeRecord = findRuntimeApiKeyByHash(keyHash);
    return runtimeRecord ? {
      ...runtimeRecord,
      scope: String(runtimeRecord.scope),
      status: String(runtimeRecord.status)
    } : null;
  }
  try {
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    const row = rows[0];
    if (!row) {
      const runtimeRecord = findRuntimeApiKeyByHash(keyHash);
      return runtimeRecord ? {
        ...runtimeRecord,
        scope: String(runtimeRecord.scope),
        status: String(runtimeRecord.status)
      } : null;
    }
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      keyPrefix: row.keyPrefix,
      keyHash: row.keyHash,
      scope: String(row.scope),
      status: String(row.status),
      rpmLimit: row.rpmLimit,
      dailyLimit: row.dailyLimit,
      lastUsedAt: row.lastUsedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.warn("[Database] findApiKeyAuthRecordByHash failed, using runtime fallback", error);
    const runtimeRecord = findRuntimeApiKeyByHash(keyHash);
    return runtimeRecord ? {
      ...runtimeRecord,
      scope: String(runtimeRecord.scope),
      status: String(runtimeRecord.status)
    } : null;
  }
}
async function touchApiKeyLastUsed(id, lastUsedAt = /* @__PURE__ */ new Date()) {
  const db = await getDb();
  if (!db) {
    return updateRuntimeApiKey(id, { lastUsedAt, updatedAt: lastUsedAt });
  }
  try {
    await db.update(apiKeys).set({ lastUsedAt, updatedAt: lastUsedAt }).where(eq(apiKeys.id, id));
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      keyPrefix: row.keyPrefix,
      scope: String(row.scope),
      status: String(row.status),
      rpmLimit: row.rpmLimit,
      dailyLimit: row.dailyLimit,
      lastUsedAt: row.lastUsedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.warn("[Database] touchApiKeyLastUsed failed, using runtime fallback", error);
    return updateRuntimeApiKey(id, { lastUsedAt, updatedAt: lastUsedAt });
  }
}
async function revokeApiKeyRecord(id) {
  const revokedAt = /* @__PURE__ */ new Date();
  const db = await getDb();
  if (!db) {
    return updateRuntimeApiKey(id, { status: "revoked", updatedAt: revokedAt });
  }
  try {
    await db.update(apiKeys).set({ status: "revoked", updatedAt: revokedAt }).where(eq(apiKeys.id, id));
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    const row = rows[0];
    if (!row) {
      return updateRuntimeApiKey(id, { status: "revoked", updatedAt: revokedAt });
    }
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      keyPrefix: row.keyPrefix,
      scope: String(row.scope),
      status: String(row.status),
      rpmLimit: row.rpmLimit,
      dailyLimit: row.dailyLimit,
      lastUsedAt: row.lastUsedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.warn("[Database] revokeApiKeyRecord failed, using runtime fallback", error);
    return updateRuntimeApiKey(id, { status: "revoked", updatedAt: revokedAt });
  }
}
async function listPlans() {
  return withMockFallback(
    "listPlans",
    async (db) => {
      const rows = await db.select().from(plans).orderBy(plans.priceUsd);
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        tier: String(row.tier),
        billingInterval: String(row.billingInterval),
        currency: row.currency,
        priceUsd: String(row.priceUsd),
        includedRequests: row.includedRequests,
        monthlyApiQuota: row.monthlyApiQuota,
        monthlyBrowserRuns: row.monthlyBrowserRuns,
        maxRpm: row.maxRpm,
        maxConcurrentJobs: row.maxConcurrentJobs,
        vipApiAccess: String(row.vipApiAccess),
        featuresJson: row.featuresJson,
        isActive: String(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => MOCK_PLANS.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      tier: String(row.tier),
      billingInterval: String(row.billingInterval),
      currency: row.currency,
      priceUsd: row.priceUsd,
      includedRequests: row.includedRequests,
      monthlyApiQuota: row.monthlyApiQuota,
      monthlyBrowserRuns: row.monthlyBrowserRuns,
      maxRpm: row.maxRpm,
      maxConcurrentJobs: row.maxConcurrentJobs,
      vipApiAccess: String(row.vipApiAccess),
      featuresJson: row.featuresJson,
      isActive: String(row.isActive)
    }))
  );
}
async function listSubscriptions() {
  return withMockFallback(
    "listSubscriptions",
    async (db) => {
      const rows = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(100);
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        planId: row.planId,
        status: row.status,
        provider: row.provider,
        externalRef: row.externalRef ?? null,
        startedAt: row.startedAt ?? null,
        currentPeriodStart: row.currentPeriodStart ?? null,
        currentPeriodEnd: row.currentPeriodEnd ?? null,
        canceledAt: row.canceledAt ?? null,
        metadataJson: row.metadataJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => MOCK_SUBSCRIPTIONS.map((row) => ({
      id: row.id,
      userId: row.userId,
      planId: row.planId,
      status: row.status,
      provider: row.provider,
      externalRef: row.externalRef ?? null,
      startedAt: new Date(row.startedAt),
      currentPeriodStart: new Date(row.currentPeriodStart),
      currentPeriodEnd: new Date(row.currentPeriodEnd),
      canceledAt: null,
      metadataJson: null
    }))
  );
}
async function listPayments() {
  return withMockFallback(
    "listPayments",
    async (db) => {
      const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        subscriptionId: row.subscriptionId ?? null,
        provider: row.provider,
        status: row.status,
        currency: row.currency,
        amount: String(row.amount),
        amountUsd: row.amountUsd ? String(row.amountUsd) : null,
        txRef: row.txRef ?? null,
        invoiceRef: row.invoiceRef ?? null,
        paidAt: row.paidAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    },
    () => MOCK_PAYMENTS.map((row) => ({
      id: row.id,
      userId: row.userId,
      subscriptionId: row.subscriptionId ?? null,
      provider: row.provider,
      status: row.status,
      currency: row.currency,
      amount: row.amount,
      amountUsd: row.amountUsd ?? null,
      txRef: row.txRef ?? null,
      invoiceRef: row.invoiceRef ?? null,
      paidAt: new Date(row.paidAt)
    }))
  );
}
async function listMetricSnapshots() {
  return withMockFallback(
    "listMetricSnapshots",
    async (db) => db.select().from(metricSnapshots).orderBy(desc(metricSnapshots.createdAt)).limit(100),
    () => []
  );
}
async function listAuditTrailEntries() {
  return withMockFallback(
    "listAuditTrailEntries",
    async (db) => {
      const rows = await db.select().from(auditTrail).orderBy(desc(auditTrail.createdAt)).limit(200);
      const databaseAudit = rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId ?? null,
        actorType: String(row.actorType),
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        status: String(row.status),
        ipAddress: row.ipAddress ?? null,
        detailsJson: row.detailsJson,
        createdAt: row.createdAt
      }));
      const runtimeAudit = listRuntimeAuditTrailEntries().map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId ?? null,
        actorType: String(row.actorType),
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        status: String(row.status),
        ipAddress: row.ipAddress ?? null,
        detailsJson: row.detailsJson,
        createdAt: row.createdAt
      }));
      const merged = [...runtimeAudit, ...databaseAudit].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const seen = /* @__PURE__ */ new Set();
      return merged.filter((row) => {
        const dedupeKey = `${row.action}:${row.resourceType}:${row.resourceId}:${row.createdAt.toISOString()}`;
        if (seen.has(dedupeKey)) {
          return false;
        }
        seen.add(dedupeKey);
        return true;
      }).slice(0, 200);
    },
    () => {
      const runtimeAudit = listRuntimeAuditTrailEntries();
      if (runtimeAudit.length > 0) {
        return runtimeAudit;
      }
      return listMockAuditTrail().map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId ?? null,
        actorType: String(row.actorType),
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        status: String(row.status),
        ipAddress: row.ipAddress ?? null,
        detailsJson: row.detailsJson,
        createdAt: row.createdAt
      }));
    }
  );
}
async function persistJobRecord(input) {
  const db = await getDb();
  if (!db) {
    return saveRuntimeJob({
      ...input,
      source: input.source,
      requestMode: input.requestMode,
      status: input.status
    });
  }
  try {
    await db.insert(jobs).values({
      publicId: input.publicId,
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      source: input.source,
      requestMode: input.requestMode,
      status: input.status,
      queueName: input.queueName,
      priority: input.priority,
      targetLabel: input.targetLabel,
      payloadJson: input.payloadJson,
      resultJson: input.resultJson ?? null,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      proxyPolicyId: input.proxyPolicyId,
      workerNodeId: input.workerNodeId,
      attemptCount: input.attemptCount,
      maxAttempts: input.maxAttempts,
      costEstimateUsd: input.costEstimateUsd ?? "0.0000",
      cogsUsd: input.cogsUsd ?? "0.0000",
      createdAt: input.createdAt,
      updatedAt: input.completedAt ?? input.startedAt ?? input.createdAt,
      startedAt: input.startedAt,
      completedAt: input.completedAt
    });
    const rows = await db.select().from(jobs).where(eq(jobs.publicId, input.publicId)).limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(`Inserted job ${input.publicId} was not found`);
    }
    return {
      id: row.id,
      publicId: row.publicId,
      userId: row.userId ?? null,
      apiKeyId: row.apiKeyId ?? null,
      source: String(row.source),
      requestMode: String(row.requestMode),
      status: String(row.status),
      queueName: row.queueName,
      priority: row.priority,
      targetLabel: row.targetLabel,
      payloadJson: row.payloadJson,
      resultJson: row.resultJson,
      errorCode: row.errorCode ?? null,
      errorMessage: row.errorMessage ?? null,
      proxyPolicyId: row.proxyPolicyId ?? null,
      workerNodeId: row.workerNodeId ?? null,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      costEstimateUsd: row.costEstimateUsd ? String(row.costEstimateUsd) : null,
      cogsUsd: row.cogsUsd ? String(row.cogsUsd) : null,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? null,
      completedAt: row.completedAt ?? null
    };
  } catch (error) {
    console.warn("[Database] persistJobRecord failed, using runtime fallback", error);
    return saveRuntimeJob({
      ...input,
      source: input.source,
      requestMode: input.requestMode,
      status: input.status
    });
  }
}
async function updateJobRecord(publicId, patch) {
  const db = await getDb();
  if (!db) {
    const existing = findRuntimeJob(publicId);
    if (!existing) {
      return null;
    }
    return updateRuntimeJob(existing.id, {
      status: patch.status ?? existing.status,
      resultJson: patch.resultJson === void 0 ? existing.resultJson : patch.resultJson,
      errorCode: patch.errorCode === void 0 ? existing.errorCode : patch.errorCode,
      errorMessage: patch.errorMessage === void 0 ? existing.errorMessage : patch.errorMessage,
      workerNodeId: patch.workerNodeId === void 0 ? existing.workerNodeId : patch.workerNodeId,
      attemptCount: patch.attemptCount === void 0 ? existing.attemptCount : patch.attemptCount,
      startedAt: patch.startedAt === void 0 ? existing.startedAt : patch.startedAt,
      completedAt: patch.completedAt === void 0 ? existing.completedAt : patch.completedAt
    });
  }
  try {
    const updateValues = {
      ...patch.status !== void 0 ? { status: patch.status } : {},
      ...patch.resultJson !== void 0 ? { resultJson: patch.resultJson ?? null } : {},
      ...patch.errorCode !== void 0 ? { errorCode: patch.errorCode } : {},
      ...patch.errorMessage !== void 0 ? { errorMessage: patch.errorMessage } : {},
      ...patch.workerNodeId !== void 0 ? { workerNodeId: patch.workerNodeId } : {},
      ...patch.attemptCount !== void 0 ? { attemptCount: patch.attemptCount } : {},
      ...patch.startedAt !== void 0 ? { startedAt: patch.startedAt } : {},
      ...patch.completedAt !== void 0 ? { completedAt: patch.completedAt } : {},
      updatedAt: patch.completedAt ?? patch.startedAt ?? /* @__PURE__ */ new Date()
    };
    await db.update(jobs).set(updateValues).where(eq(jobs.publicId, publicId));
    const rows = await db.select().from(jobs).where(eq(jobs.publicId, publicId)).limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      publicId: row.publicId,
      userId: row.userId ?? null,
      apiKeyId: row.apiKeyId ?? null,
      source: String(row.source),
      requestMode: String(row.requestMode),
      status: String(row.status),
      queueName: row.queueName,
      priority: row.priority,
      targetLabel: row.targetLabel,
      payloadJson: row.payloadJson,
      resultJson: row.resultJson,
      errorCode: row.errorCode ?? null,
      errorMessage: row.errorMessage ?? null,
      proxyPolicyId: row.proxyPolicyId ?? null,
      workerNodeId: row.workerNodeId ?? null,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      costEstimateUsd: row.costEstimateUsd ? String(row.costEstimateUsd) : null,
      cogsUsd: row.cogsUsd ? String(row.cogsUsd) : null,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? null,
      completedAt: row.completedAt ?? null
    };
  } catch (error) {
    console.warn("[Database] updateJobRecord failed, using runtime fallback", error);
    const existing = findRuntimeJob(publicId);
    if (!existing) {
      return null;
    }
    return updateRuntimeJob(existing.id, {
      status: patch.status ?? existing.status,
      resultJson: patch.resultJson === void 0 ? existing.resultJson : patch.resultJson,
      errorCode: patch.errorCode === void 0 ? existing.errorCode : patch.errorCode,
      errorMessage: patch.errorMessage === void 0 ? existing.errorMessage : patch.errorMessage,
      workerNodeId: patch.workerNodeId === void 0 ? existing.workerNodeId : patch.workerNodeId,
      attemptCount: patch.attemptCount === void 0 ? existing.attemptCount : patch.attemptCount,
      startedAt: patch.startedAt === void 0 ? existing.startedAt : patch.startedAt,
      completedAt: patch.completedAt === void 0 ? existing.completedAt : patch.completedAt
    });
  }
}
async function persistJobEvents(entries) {
  if (entries.length === 0) {
    return;
  }
  const db = await getDb();
  if (!db) {
    saveRuntimeJobEvents(entries);
    return;
  }
  try {
    await db.insert(jobEvents).values(
      entries.map((entry) => ({
        jobId: entry.jobId,
        eventType: entry.eventType,
        severity: entry.severity,
        message: entry.message,
        eventJson: entry.eventJson ?? null,
        createdAt: entry.createdAt
      }))
    );
  } catch (error) {
    console.warn("[Database] persistJobEvents failed, using runtime fallback", error);
    saveRuntimeJobEvents(entries);
  }
}
async function persistApiKeyRecord(input) {
  const db = await getDb();
  if (!db) {
    const runtimeRecord = saveRuntimeApiKey(input);
    return { ...runtimeRecord, keyHash: input.keyHash };
  }
  try {
    await db.insert(apiKeys).values({
      userId: input.userId,
      label: input.label,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      scope: input.scope,
      status: input.status,
      rpmLimit: input.rpmLimit,
      dailyLimit: input.dailyLimit,
      lastUsedAt: input.lastUsedAt,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    });
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, input.keyPrefix)).limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(`Inserted api key ${input.keyPrefix} was not found`);
    }
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      keyPrefix: row.keyPrefix,
      keyHash: row.keyHash,
      scope: String(row.scope),
      status: String(row.status),
      rpmLimit: row.rpmLimit,
      dailyLimit: row.dailyLimit,
      lastUsedAt: row.lastUsedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.warn("[Database] persistApiKeyRecord failed, using runtime fallback", error);
    const runtimeRecord = saveRuntimeApiKey(input);
    return { ...runtimeRecord, keyHash: input.keyHash };
  }
}
async function persistUsageRecord(input) {
  const db = await getDb();
  if (!db) {
    saveRuntimeUsageRecord(input);
    return;
  }
  try {
    await db.insert(usageRecords).values({
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      jobId: input.jobId,
      metricType: input.metricType,
      quantity: input.quantity,
      unitCostUsd: input.unitCostUsd,
      totalCostUsd: input.totalCostUsd,
      periodKey: input.periodKey,
      metadataJson: input.metadataJson ?? null,
      createdAt: input.createdAt
    });
  } catch (error) {
    console.warn("[Database] persistUsageRecord failed, using runtime fallback", error);
    saveRuntimeUsageRecord(input);
  }
}
async function persistWorkerRun(input) {
  const db = await getDb();
  if (!db) {
    saveRuntimeWorkerRun(input);
    return;
  }
  try {
    await db.insert(workerRuns).values({
      jobId: input.jobId,
      workerNodeId: input.workerNodeId,
      runStatus: input.runStatus,
      attemptNumber: input.attemptNumber,
      profilePolicy: input.profilePolicy,
      fingerprintProfile: input.fingerprintProfile,
      runtimeMs: input.runtimeMs,
      detailsJson: input.detailsJson ?? null,
      createdAt: input.createdAt,
      finishedAt: input.finishedAt
    });
  } catch (error) {
    console.warn("[Database] persistWorkerRun failed, using runtime fallback", error);
    saveRuntimeWorkerRun(input);
  }
}
async function persistProxyLease(input) {
  const db = await getDb();
  if (!db) {
    saveRuntimeProxyLease(input);
    return;
  }
  try {
    await db.insert(proxyLeases).values({
      leaseId: input.leaseId,
      jobId: input.jobId,
      workerNodeId: input.workerNodeId,
      providerId: input.providerId,
      policyId: input.policyId,
      protocol: input.protocol,
      sessionMode: input.sessionMode,
      sessionKey: input.sessionKey,
      endpointHost: input.endpointHost,
      endpointPort: input.endpointPort,
      country: input.country,
      status: input.status,
      bytesSent: input.bytesSent,
      bytesReceived: input.bytesReceived,
      estimatedCostUsd: input.estimatedCostUsd,
      lastErrorCode: input.lastErrorCode,
      metadataJson: input.metadataJson ?? null,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      releasedAt: input.releasedAt
    });
  } catch (error) {
    console.warn("[Database] persistProxyLease failed, using runtime fallback", error);
    saveRuntimeProxyLease(input);
  }
}
function mapBotTextSettingRow(row) {
  const value = row.valueJson ?? null;
  return {
    id: row.id,
    key: row.settingKey,
    title: typeof value?.title === "string" && value.title.trim().length > 0 ? value.title : row.settingKey,
    description: typeof value?.description === "string" && value.description.trim().length > 0 ? value.description : null,
    body: typeof value?.body === "string" ? value.body : "",
    updatedByUserId: row.updatedByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function mapTelegramRecipientRow(row) {
  return {
    id: row.id,
    userId: row.userId ?? null,
    botLabel: row.botLabel,
    chatId: row.chatId ?? "",
    status: String(row.status),
    commandScope: row.commandScope,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
async function listBotTextSettings() {
  const fallbackRows = listRuntimeBotTexts().map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    body: row.body,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
  const db = await getDb();
  if (!db) {
    return fallbackRows;
  }
  try {
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.category, "bot_text")).orderBy(desc(systemSettings.updatedAt)).limit(100);
    return rows.map(mapBotTextSettingRow);
  } catch (error) {
    console.warn("[Database] listBotTextSettings failed, using runtime fallback", error);
    return fallbackRows;
  }
}
async function upsertBotTextSetting(input) {
  const db = await getDb();
  if (!db) {
    return saveRuntimeBotText({
      key: input.key,
      title: input.title,
      description: input.description,
      body: input.body,
      updatedByUserId: input.updatedByUserId,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt
    });
  }
  try {
    const existingRows = await db.select().from(systemSettings).where(and(eq(systemSettings.category, "bot_text"), eq(systemSettings.settingKey, input.key))).limit(1);
    if (existingRows[0]) {
      await db.update(systemSettings).set({
        valueJson: {
          title: input.title,
          description: input.description,
          body: input.body
        },
        updatedByUserId: input.updatedByUserId,
        updatedAt: input.updatedAt
      }).where(eq(systemSettings.id, existingRows[0].id));
    } else {
      await db.insert(systemSettings).values({
        category: "bot_text",
        settingKey: input.key,
        valueJson: {
          title: input.title,
          description: input.description,
          body: input.body
        },
        updatedByUserId: input.updatedByUserId,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt
      });
    }
    const rows = await db.select().from(systemSettings).where(and(eq(systemSettings.category, "bot_text"), eq(systemSettings.settingKey, input.key))).limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(`Bot text ${input.key} was not found after upsert`);
    }
    return mapBotTextSettingRow(row);
  } catch (error) {
    console.warn("[Database] upsertBotTextSetting failed, using runtime fallback", error);
    return saveRuntimeBotText({
      key: input.key,
      title: input.title,
      description: input.description,
      body: input.body,
      updatedByUserId: input.updatedByUserId,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt
    });
  }
}
async function listTelegramRecipients(options) {
  const activeOnly = options?.activeOnly ?? false;
  const fallbackRows = listRuntimeTelegramRecipients().filter((row) => activeOnly ? row.status === "active" : true).map((row) => ({
    id: row.id,
    userId: row.userId,
    botLabel: row.botLabel,
    chatId: row.chatId,
    status: row.status,
    commandScope: row.commandScope,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
  const db = await getDb();
  if (!db) {
    return fallbackRows;
  }
  try {
    const rows = await db.select().from(telegramEndpoints).orderBy(desc(telegramEndpoints.updatedAt)).limit(500);
    return rows.map(mapTelegramRecipientRow).filter((row) => row.chatId.trim().length > 0).filter((row) => activeOnly ? row.status === "active" : true);
  } catch (error) {
    console.warn("[Database] listTelegramRecipients failed, using runtime fallback", error);
    return fallbackRows;
  }
}
async function updateWorkerNodeHeartbeat(nodeId, patch) {
  const db = await getDb();
  if (!db) {
    const { updateRuntimeWorkerNode: updateRuntimeWorkerNode2 } = await Promise.resolve().then(() => (init_runtimeStore(), runtimeStore_exports));
    return updateRuntimeWorkerNode2(nodeId, patch);
  }
  try {
    const updateValues = {
      lastHeartbeatAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (patch.status !== void 0) updateValues.status = patch.status;
    if (patch.activeJobs !== void 0) updateValues.activeJobs = patch.activeJobs;
    if (patch.version !== void 0) updateValues.version = patch.version;
    if (patch.concurrencyLimit !== void 0) updateValues.concurrencyLimit = patch.concurrencyLimit;
    await db.update(workerNodes).set(updateValues).where(eq(workerNodes.id, nodeId));
    const rows = await db.select().from(workerNodes).where(eq(workerNodes.id, nodeId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      role: String(row.role),
      status: String(row.status),
      concurrencyLimit: row.concurrencyLimit,
      activeJobs: row.activeJobs,
      version: row.version ?? null,
      hostLabel: row.hostLabel ?? null,
      capabilitiesJson: row.capabilitiesJson,
      lastHeartbeatAt: row.lastHeartbeatAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.warn("[Database] updateWorkerNodeHeartbeat failed, using runtime fallback", error);
    const { updateRuntimeWorkerNode: updateRuntimeWorkerNode2 } = await Promise.resolve().then(() => (init_runtimeStore(), runtimeStore_exports));
    return updateRuntimeWorkerNode2(nodeId, patch);
  }
}
async function persistAuditTrailEntry(input) {
  const db = await getDb();
  if (!db) {
    saveRuntimeAuditTrailEntry({
      ...input,
      actorType: input.actorType,
      status: input.status
    });
    return;
  }
  try {
    await db.insert(auditTrail).values({
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: input.status,
      ipAddress: input.ipAddress,
      detailsJson: input.detailsJson ?? null,
      createdAt: input.createdAt
    });
  } catch (error) {
    console.warn("[Database] persistAuditTrailEntry failed, using runtime fallback", error);
    saveRuntimeAuditTrailEntry({
      ...input,
      actorType: input.actorType,
      status: input.status
    });
  }
}
async function getRateLimitHits(keyPrefix, windowType) {
  const db = await getDb();
  if (!db) return 0;
  const now = /* @__PURE__ */ new Date();
  const windowKey = windowType === "minute" ? `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}` : `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  try {
    const rows = await db.select({ hits: apiRateLimits.hits }).from(apiRateLimits).where(
      and(
        eq(apiRateLimits.keyPrefix, keyPrefix),
        eq(apiRateLimits.windowKey, windowKey)
      )
    ).limit(1);
    return rows.length > 0 ? Number(rows[0].hits) : 0;
  } catch {
    return 0;
  }
}
async function incrementRateLimitHits(keyPrefix, windowType) {
  const db = await getDb();
  if (!db) return 0;
  const now = /* @__PURE__ */ new Date();
  const windowKey = windowType === "minute" ? `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}` : `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  try {
    await db.execute(
      sql`
        INSERT INTO api_rate_limits (key_prefix, window_key, window_type, hits, created_at, updated_at)
        VALUES (${keyPrefix}, ${windowKey}, ${windowType}, 1, ${now}, ${now})
        ON DUPLICATE KEY UPDATE hits = hits + 1, updated_at = ${now}
      `
    );
    const rows = await db.select({ hits: apiRateLimits.hits }).from(apiRateLimits).where(
      and(
        eq(apiRateLimits.keyPrefix, keyPrefix),
        eq(apiRateLimits.windowKey, windowKey)
      )
    ).limit(1);
    return rows.length > 0 ? Number(rows[0].hits) : 1;
  } catch {
    return 0;
  }
}
async function getDailyHits(keyPrefix) {
  return getRateLimitHits(keyPrefix, "daily");
}
async function incrementDailyHits(keyPrefix) {
  return incrementRateLimitHits(keyPrefix, "daily");
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    init_platformMockData();
    init_runtimeStore();
    init_runtimeStore();
    _db = null;
  }
});

// server/_core/index.ts
import "dotenv/config";
import express3 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { z as z5 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1e3;
var UNAUTHED_ERR_MSG = "Unauthorized \u2014 no valid session";
var NOT_ADMIN_ERR_MSG = "Forbidden \u2014 admin access required";

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_platform();

// server/platformService.ts
init_platform();
import { createHash as createHash2, randomBytes as randomBytes2 } from "crypto";

// shared/importedLeadFormat.ts
init_oneCsScoring();
import { z as z4 } from "zod";
var emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
var phonePattern = /\(\d{3}\)\s*\d{3}-\d{4}/g;
var scorePattern = /credit score:\s*(\d{3})/i;
var agePattern = /^(\d{1,3})\s+years?\s+old/i;
var ageLabelPattern = /^AGE:\s*(\d{1,3})/i;
var dobPattern = /^DOB:\s*(.+)$/i;
var bornPattern = /^BORN:\s*(.+)$/i;
var ssnPattern = /^SSN:\s*(.+)$/i;
var headerPattern = /\[[^\]]+\]$/;
var stateZipPattern = /,?\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/;
var importedLeadRecordSchema = z4.object({
  blockIndex: z4.number().int().min(1),
  sourceLabel: z4.string().nullable(),
  fullName: z4.string().min(1),
  addressRaw: z4.string().nullable(),
  city: z4.string().nullable(),
  state: z4.string().nullable(),
  postalCode: z4.string().nullable(),
  age: z4.number().int().nullable(),
  bornText: z4.string().nullable(),
  dobText: z4.string().nullable(),
  hasSsn: z4.boolean(),
  email: z4.string().nullable(),
  emailDomain: z4.string().nullable(),
  phoneNumbers: z4.array(z4.string()),
  creditScore: z4.number().int().nullable(),
  flags: z4.array(z4.string()),
  completenessScore: z4.number().min(0).max(1),
  oneCsResult: oneCsResultSchema
});
var safeImportedLeadRecordSchema = importedLeadRecordSchema.extend({
  fullName: z4.string(),
  email: z4.null(),
  phoneNumbers: z4.array(z4.string()),
  normalizedTarget: z4.string(),
  piiRedacted: z4.literal(true)
});
function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
function isSourceHeader(line) {
  return line.includes(", [") || headerPattern.test(line);
}
function shouldTreatFirstLineAsSourceHeader(lines) {
  if (lines.length < 3) return false;
  const [first, second, third] = lines;
  if (!first || !second || !third) return false;
  return isLikelyName(first) && isLikelyName(second) && !isLikelyName(third);
}
function isLikelyName(line) {
  return /^[A-Za-z][A-Za-z'?. -]+$/.test(line) && !/^DOB:/i.test(line) && !/^SSN:/i.test(line);
}
function extractEmailDomain(email) {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}
function maskName(fullName) {
  const tokens = compactWhitespace(fullName).split(" ").filter(Boolean);
  return tokens.map((token) => {
    const [firstChar = "X", ...restChars] = Array.from(token);
    const maskedRest = restChars.map((char) => /^[A-Za-z0-9]$/.test(char) ? "*" : char).join("");
    return `${firstChar.toUpperCase()}${maskedRest}`;
  }).join(" ");
}
function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  const last2 = digits.slice(-2).padStart(2, "0");
  return `(***) ***-**${last2}`;
}
function parseAddress(addressLines) {
  if (addressLines.length === 0) {
    return {
      addressRaw: null,
      city: null,
      state: null,
      postalCode: null
    };
  }
  const addressRaw = compactWhitespace(addressLines.join(", "));
  const stateZipMatch = addressRaw.match(stateZipPattern);
  let state = null;
  let postalCode = null;
  let city = null;
  if (stateZipMatch) {
    state = stateZipMatch[1] ?? null;
    postalCode = stateZipMatch[2] ?? null;
    const beforeState = addressRaw.slice(0, stateZipMatch.index).trim();
    const segments = beforeState.split(",").map((segment) => compactWhitespace(segment)).filter(Boolean);
    city = segments.length > 0 ? segments[segments.length - 1] ?? null : null;
  }
  return {
    addressRaw,
    city,
    state,
    postalCode
  };
}
function parseBlock(block, blockIndex) {
  const rawLines = block.split(/\r?\n/).map((line) => compactWhitespace(line)).filter(Boolean);
  if (rawLines.length === 0) return null;
  let sourceLabel = null;
  const lines = [...rawLines];
  if (isSourceHeader(lines[0] ?? "") || shouldTreatFirstLineAsSourceHeader(lines)) {
    sourceLabel = lines.shift() ?? null;
  }
  const fullName = lines.shift();
  if (!fullName || !isLikelyName(fullName)) {
    return null;
  }
  const addressLines = [];
  const phoneNumbers = /* @__PURE__ */ new Set();
  const flags = /* @__PURE__ */ new Set();
  let age = null;
  let bornText = null;
  let dobText = null;
  let hasSsn = false;
  let email = null;
  let creditScore = null;
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (upperLine === "NF") {
      flags.add("no_phone_or_email_marker");
      continue;
    }
    if (line.includes("?")) {
      flags.add("contains_uncertain_marker");
    }
    const ageMatch = line.match(agePattern) ?? line.match(ageLabelPattern);
    if (ageMatch) {
      age = Number(ageMatch[1]);
      continue;
    }
    const bornMatch = line.match(bornPattern);
    if (bornMatch) {
      bornText = compactWhitespace(bornMatch[1] ?? "");
      continue;
    }
    const dobMatch = line.match(dobPattern);
    if (dobMatch) {
      dobText = compactWhitespace(dobMatch[1] ?? "");
      continue;
    }
    if (ssnPattern.test(line)) {
      hasSsn = true;
      continue;
    }
    const emailMatch = line.match(emailPattern);
    if (emailMatch) {
      email = emailMatch[0].toLowerCase();
      continue;
    }
    const phoneMatches = Array.from(line.matchAll(phonePattern), (match) => match[0]);
    if (phoneMatches.length > 0) {
      phoneMatches.forEach((match) => phoneNumbers.add(match));
      continue;
    }
    const scoreMatch = line.match(scorePattern);
    if (scoreMatch) {
      creditScore = Number(scoreMatch[1]);
      continue;
    }
    addressLines.push(line);
  }
  const address = parseAddress(addressLines.slice(0, 2));
  const completenessSignals = [address.addressRaw, age, dobText, email, phoneNumbers.size > 0 ? "phones" : null, creditScore, hasSsn ? "ssn" : null];
  const completenessScore = Number(
    (completenessSignals.filter(Boolean).length / completenessSignals.length).toFixed(2)
  );
  const inferredAdverseReasons = [];
  if (creditScore === null) {
    inferredAdverseReasons.push("Insufficient credit history");
  }
  if (completenessScore < 0.5) {
    inferredAdverseReasons.push("Insufficient number of accounts");
  }
  const oneCsResult = buildOneCsResult({
    creditScore,
    completenessScore,
    adverseReasons: inferredAdverseReasons,
    priceUsd: 0,
    durationMs: 0,
    source: "import"
  });
  return importedLeadRecordSchema.parse({
    blockIndex,
    sourceLabel,
    fullName,
    addressRaw: address.addressRaw,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    age,
    bornText,
    dobText,
    hasSsn,
    email,
    emailDomain: extractEmailDomain(email),
    phoneNumbers: Array.from(phoneNumbers),
    creditScore,
    flags: Array.from(flags),
    completenessScore,
    oneCsResult
  });
}
function parseImportedLeadText(input) {
  return input.split(/\n\s*\n+/).map((block, index2) => parseBlock(block, index2 + 1)).filter((record) => record !== null);
}
function toSafeImportedLeadRecord(record) {
  return safeImportedLeadRecordSchema.parse({
    ...record,
    fullName: maskName(record.fullName),
    email: null,
    phoneNumbers: record.phoneNumbers.map(maskPhone),
    normalizedTarget: `mock://lead-import/${record.blockIndex}`,
    piiRedacted: true
  });
}
function buildSafeLeadImportPayloads(input) {
  return parseImportedLeadText(input).map((record) => {
    const safeRecord = toSafeImportedLeadRecord(record);
    return {
      targetLabel: safeRecord.fullName,
      queueName: "lead-import",
      priority: 110,
      safeTestMode: true,
      payload: {
        target: safeRecord.normalizedTarget,
        action: "normalize_imported_lead_record",
        piiRedacted: true,
        sourceLabel: safeRecord.sourceLabel,
        city: safeRecord.city,
        state: safeRecord.state,
        postalCode: safeRecord.postalCode,
        age: safeRecord.age,
        hasSsn: safeRecord.hasSsn,
        hasDob: Boolean(safeRecord.dobText),
        phoneCount: safeRecord.phoneNumbers.length,
        emailDomain: safeRecord.emailDomain,
        hasCreditScore: safeRecord.creditScore !== null,
        flags: safeRecord.flags,
        completenessScore: safeRecord.completenessScore,
        productScore: safeRecord.oneCsResult.productScore,
        dataQualityScore: safeRecord.oneCsResult.dataQualityScore,
        oneCsStatus: safeRecord.oneCsResult.status,
        adverseReasonGroups: safeRecord.oneCsResult.adverseReasonGroups
      }
    };
  });
}

// server/platformService.ts
init_oneCsScoring();

// server/_core/proxy.ts
init_env();
init_runtimeStore();
import { randomBytes } from "crypto";
var ROTATE_AFTER_N = parseInt(process.env.ROTATE_AFTER_N_SUCCESS ?? "20", 10);
var ROTATE_ON_ERRORS = parseInt(process.env.ROTATE_ON_ERROR_COUNT ?? "2", 10);
var EVOMI_HOST = ENV.evomiUsername ? "core-residential.evomi.com" : "";
var EVOMI_PORT = 1e3;
var PROXY_TEST_URL = "https://api.ipify.org?format=text";
var PROXY_TEST_TIMEOUT_MS = 1e4;
var CIRCUIT_BREAKER_THRESHOLD = 5;
var CIRCUIT_BREAKER_RESET_MS = 6e4;
var _redis = null;
async function getRedis() {
  if (_redis) return _redis;
  if (!ENV.redisUrl) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: ENV.redisUrl });
    client.on("error", () => {
      _redis = null;
    });
    await client.connect();
    _redis = client;
    return _redis;
  } catch {
    return null;
  }
}
async function redisGet(key) {
  const r = await getRedis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}
async function redisSet(key, value, ttlSeconds) {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { EX: ttlSeconds });
  } catch {
  }
}
async function redisDel(key) {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
  }
}
var _activeSessions = /* @__PURE__ */ new Map();
var _mutexLocks = /* @__PURE__ */ new Map();
var _workerId = `worker_${randomBytes(4).toString("hex")}`;
function sessionCacheKey(provider, userId, jobPublicId) {
  if (userId != null) return `${provider}:user:${userId}`;
  if (jobPublicId) return `${provider}:job:${jobPublicId}`;
  return `${provider}:global`;
}
function sessionMutexKey(provider, userId) {
  return `proxy:lock:${provider}:user:${userId ?? "anon"}`;
}
function tryAcquireMutex(key) {
  const now = Date.now();
  const existing = _mutexLocks.get(key);
  if (existing && now - existing.lockedAt < 3e4 && existing.lockedBy !== _workerId) {
    return false;
  }
  _mutexLocks.set(key, { lockedBy: _workerId, lockedAt: now });
  return true;
}
function releaseMutex(key) {
  const existing = _mutexLocks.get(key);
  if (existing?.lockedBy === _workerId) _mutexLocks.delete(key);
}
function isCircuitOpen(session) {
  if (!session.circuitOpenedAt) return false;
  if (Date.now() - session.circuitOpenedAt > CIRCUIT_BREAKER_RESET_MS) {
    session.circuitOpenedAt = null;
    session.circuitBreakerFailures = 0;
    return false;
  }
  return true;
}
async function fetchThroughProxy(lease) {
  try {
    return await new Promise((resolve) => {
      const httpMod = __require("http");
      const url = new URL(PROXY_TEST_URL);
      const req = httpMod.request(
        {
          method: "GET",
          hostname: url.hostname,
          port: url.port || "80",
          path: url.pathname + url.search,
          host: `${lease.host}:${lease.port}`,
          proxy: `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`,
          timeout: PROXY_TEST_TIMEOUT_MS
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            resolve(data.trim() || null);
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  } catch {
    return null;
  }
}
function isEvomiConfigured() {
  return Boolean(ENV.evomiUsername && ENV.evomiPassword);
}
function isDataImpulseConfigured() {
  return Boolean(ENV.dataImpulseApiKey && ENV.dataImpulseUsername && ENV.dataImpulsePassword);
}
function buildEvomiLease(opts, assignedIp, rotatedFrom, rotatedReason) {
  const sessionKey = opts.userId != null ? `evomi:user:${opts.userId}` : opts.jobPublicId ? `evomi:job:${opts.jobPublicId}` : `evomi:global`;
  const leaseId = `ev_${randomBytes(6).toString("hex")}`;
  const ttlMs = (ENV.sessionTtlMinutes ?? 1440) * 60 * 1e3;
  const country = opts.country ?? null;
  const rawPassword = ENV.evomiPassword ?? "";
  const password = country ? `${rawPassword}_country-${country}` : rawPassword;
  return {
    leaseId,
    provider: "evomi",
    protocol: "http",
    host: EVOMI_HOST,
    port: EVOMI_PORT,
    username: ENV.evomiUsername ?? "",
    password,
    sessionKey,
    country,
    assignedIp,
    createdAt: /* @__PURE__ */ new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
    bytesUsed: 0,
    estimatedCostUsd: 0,
    successCount: 1,
    rotateAfterN: opts.rotateAfterN ?? ROTATE_AFTER_N,
    metadata: {
      leaseId,
      sessionKey,
      country: opts.country ?? null,
      rotateAfterN: opts.rotateAfterN ?? ROTATE_AFTER_N,
      successCount: 1,
      userId: opts.userId ?? null,
      jobPublicId: opts.jobPublicId ?? null,
      rotatedFrom: rotatedFrom ?? null,
      rotatedReason: rotatedReason ?? null
    }
  };
}
async function dataImpulseCreateSession(opts) {
  if (!isDataImpulseConfigured()) throw new Error("DataImpulse not configured");
  const resp = await fetch("https://api.dataimpulse.com/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ENV.dataImpulseApiKey ?? ""
    },
    body: JSON.stringify({
      auth: { username: ENV.dataImpulseUsername, password: ENV.dataImpulsePassword },
      protocol: "http",
      quantity: 1,
      ...opts.country ? { location: { country: opts.country } } : {}
    }),
    signal: AbortSignal.timeout(12e3)
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "unknown");
    throw new Error(`DataImpulse API ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  return {
    leaseId: data.id,
    host: data.proxy.host,
    port: data.proxy.port,
    username: data.proxy.username,
    password: data.proxy.password,
    country: data.proxy.country,
    expiresAt: new Date(data.expires_at),
    bandwidthUsedBytes: data.bandwidth_used_bytes,
    estimatedCostUsd: data.estimated_cost_usd
  };
}
async function acquireProxy(opts = {}) {
  const cacheKey = sessionCacheKey("evomi", opts.userId ?? null, opts.jobPublicId);
  const rotateAfterN = opts.rotateAfterN ?? ROTATE_AFTER_N;
  const mutexKey = sessionMutexKey("evomi", opts.userId ?? null);
  const gotMutex = tryAcquireMutex(mutexKey);
  const inMemory = _activeSessions.get(cacheKey);
  if (inMemory && inMemory.lease.expiresAt.getTime() > Date.now() + 3e4) {
    if (isCircuitOpen(inMemory)) {
      console.warn(`[ProxyManager] Circuit open for ${cacheKey}, forcing new acquisition`);
      _activeSessions.delete(cacheKey);
    } else if (inMemory.successCount >= rotateAfterN) {
      console.info(`[ProxyManager] Rotation: ${inMemory.successCount} \u2265 ${rotateAfterN} successes`);
      _activeSessions.delete(cacheKey);
    } else {
      inMemory.successCount++;
      inMemory.lastUsedAt = /* @__PURE__ */ new Date();
      await redisSet(cacheKey, JSON.stringify(inMemory.lease), 3600);
      return inMemory.lease;
    }
  }
  if (!gotMutex) {
    const cached = await redisGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now() + 3e4) {
          const existing = _activeSessions.get(cacheKey);
          if (existing) {
            existing.successCount++;
            existing.lastUsedAt = /* @__PURE__ */ new Date();
            return existing.lease;
          }
          _activeSessions.set(cacheKey, {
            lease: parsed,
            successCount: parsed.metadata.successCount,
            errorCount: 0,
            lastUsedAt: /* @__PURE__ */ new Date(),
            circuitBreakerFailures: 0,
            circuitOpenedAt: null
          });
          return parsed;
        }
      } catch {
      }
    }
  }
  if (isEvomiConfigured()) {
    const rotatedFrom = inMemory?.lease.leaseId ?? null;
    const rotatedReason = inMemory ? "rotation_after_n_success" : null;
    const lease = buildEvomiLease(opts, null, rotatedFrom, rotatedReason);
    const assignedIp = await fetchThroughProxy(lease);
    if (assignedIp) {
      lease.assignedIp = assignedIp;
      console.info(
        `[ProxyManager] Evomi sticky session lease=${lease.leaseId} ip=${assignedIp} sessionKey=${lease.sessionKey} rotateAfter=${rotateAfterN}`
      );
    } else {
      console.warn(`[ProxyManager] Evomi proxy connected but IP fetch failed \u2014 will retry on first use`);
    }
    _activeSessions.set(cacheKey, {
      lease,
      successCount: 1,
      errorCount: 0,
      lastUsedAt: /* @__PURE__ */ new Date(),
      circuitBreakerFailures: 0,
      circuitOpenedAt: null
    });
    await redisSet(cacheKey, JSON.stringify(lease), 3600);
    return lease;
  }
  if (isDataImpulseConfigured()) {
    try {
      const session = await dataImpulseCreateSession({ country: opts.country });
      const leaseId = `di_${randomBytes(6).toString("hex")}`;
      const lease = {
        leaseId,
        provider: "dataimpulse",
        protocol: "http",
        host: session.host,
        port: session.port,
        username: session.username,
        password: session.password,
        sessionKey: `dataimpulse:${session.leaseId}`,
        country: session.country,
        assignedIp: null,
        createdAt: /* @__PURE__ */ new Date(),
        expiresAt: session.expiresAt,
        bytesUsed: session.bandwidthUsedBytes,
        estimatedCostUsd: session.estimatedCostUsd,
        successCount: 1,
        rotateAfterN,
        metadata: {
          leaseId,
          sessionKey: `dataimpulse:${session.leaseId}`,
          country: session.country,
          rotateAfterN,
          successCount: 1,
          userId: opts.userId ?? null,
          jobPublicId: opts.jobPublicId ?? null,
          rotatedFrom: null,
          rotatedReason: null
        }
      };
      _activeSessions.set(cacheKey, {
        lease,
        successCount: 1,
        errorCount: 0,
        lastUsedAt: /* @__PURE__ */ new Date(),
        circuitBreakerFailures: 0,
        circuitOpenedAt: null
      });
      console.info(
        `[ProxyManager] DataImpulse session lease=${lease.leaseId} host=${session.host}:${session.port} country=${session.country}`
      );
      return lease;
    } catch (err) {
      console.error("[ProxyManager] DataImpulse fallback failed:", err);
    }
  }
  console.warn("[ProxyManager] No proxy providers configured, returning null (mock mode)");
  return null;
}
async function doRelease(lease, cacheKey) {
  _activeSessions.delete(cacheKey);
  await redisDel(cacheKey);
  releaseMutex(sessionMutexKey("evomi", lease.metadata.userId));
}
async function releaseProxy(opts) {
  const allSessions = Array.from(_activeSessions.entries());
  const entry = allSessions.find(([, s]) => s.lease.leaseId === opts.leaseId);
  if (!entry) {
    return;
  }
  const [cacheKey, session] = entry;
  if (opts.success) {
    session.successCount++;
    session.lastUsedAt = /* @__PURE__ */ new Date();
    session.circuitBreakerFailures = 0;
    session.circuitOpenedAt = null;
    saveRuntimeProxyLease({
      leaseId: opts.leaseId,
      jobId: null,
      workerNodeId: null,
      providerId: session.lease.provider === "evomi" ? 1 : 2,
      policyId: null,
      protocol: session.lease.protocol,
      sessionMode: "sticky",
      sessionKey: session.lease.sessionKey,
      endpointHost: session.lease.host,
      endpointPort: session.lease.port,
      country: session.lease.country,
      status: "released",
      bytesSent: opts.bytesSent ?? 0,
      bytesReceived: opts.bytesReceived ?? 0,
      estimatedCostUsd: session.lease.estimatedCostUsd.toFixed(4),
      lastErrorCode: null,
      metadataJson: {
        ...session.lease.metadata,
        successCount: session.successCount,
        assignedIp: session.lease.assignedIp
      },
      createdAt: session.lease.createdAt,
      expiresAt: session.lease.expiresAt,
      releasedAt: /* @__PURE__ */ new Date()
    });
    if (session.successCount >= session.lease.rotateAfterN) {
      console.info(
        `[ProxyManager] Rotation threshold: ${session.successCount} \u2265 ${session.lease.rotateAfterN} for ${opts.leaseId}`
      );
      await doRelease(session.lease, cacheKey);
    } else {
      const updatedLease = { ...session.lease, successCount: session.successCount };
      await redisSet(cacheKey, JSON.stringify(updatedLease), 3600);
    }
  } else {
    session.errorCount++;
    session.lastUsedAt = /* @__PURE__ */ new Date();
    const transportErrors = [
      "TRANSPORT_ERROR",
      "PROXY_ERROR",
      "CONNECTION_TIMEOUT",
      "PROXY_AUTH_FAILED",
      "ETIMEDOUT",
      "ECONNRESET",
      "ENOTFOUND"
    ];
    const isTransport = transportErrors.includes(opts.errorCode ?? "");
    if (isTransport) {
      session.circuitBreakerFailures++;
      if (session.circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        session.circuitOpenedAt = Date.now();
        console.warn(
          `[ProxyManager] Circuit opened after ${session.circuitBreakerFailures} transport errors on ${opts.leaseId}`
        );
        await doRelease(session.lease, cacheKey);
        return;
      }
    }
    if (session.errorCount >= ROTATE_ON_ERRORS || session.circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.warn(`[ProxyManager] Error threshold reached for ${opts.leaseId}, rotating`);
      await doRelease(session.lease, cacheKey);
    } else {
      console.warn(
        `[ProxyManager] Non-fatal error ${opts.errorCode} on ${opts.leaseId} (${session.errorCount}/${ROTATE_ON_ERRORS}), keeping lease`
      );
    }
  }
}
async function healthCheck() {
  const evomiConfigured = isEvomiConfigured();
  let evomiLatencyMs = -1;
  let evomiStatus = "disabled";
  if (evomiConfigured) {
    const start = Date.now();
    try {
      const evomiRawPassword = ENV.evomiPassword ?? "";
      const evomiPasswordForHealth = evomiRawPassword ? `${evomiRawPassword}_country-US` : evomiRawPassword;
      const resp = await fetch(`http://${ENV.evomiUsername}:${evomiPasswordForHealth}@${EVOMI_HOST}:${EVOMI_PORT}`, {
        method: "CONNECT",
        path: "api.ipify.org:443",
        signal: AbortSignal.timeout(5e3)
      });
      evomiLatencyMs = Date.now() - start;
      evomiStatus = resp.ok || resp.status === 200 ? "healthy" : "degraded";
    } catch {
      evomiStatus = "degraded";
    }
  }
  const redisConfigured = Boolean(ENV.redisUrl);
  const r = redisConfigured ? await getRedis() : null;
  const redisStatus = redisConfigured ? r ? "healthy" : "degraded" : "disabled";
  const circuitOpenCount = Array.from(_activeSessions.values()).filter((s) => isCircuitOpen(s)).length;
  return {
    evomi: { configured: evomiConfigured, latencyMs: evomiLatencyMs, status: evomiStatus },
    dataImpulse: { configured: isDataImpulseConfigured(), status: isDataImpulseConfigured() ? "healthy" : "disabled" },
    redis: { configured: redisConfigured, status: redisStatus },
    activeSessions: _activeSessions.size,
    circuitOpenCount
  };
}

// server/platformService.ts
init_db();
init_platformMockData();
init_runtimeStore();
function createPublicId(prefix) {
  return `${prefix}_${randomBytes2(6).toString("hex")}`;
}
function hashToken(raw) {
  return createHash2("sha256").update(raw).digest("hex");
}
function estimateCost(mode, payloadSize) {
  const base = mode === "vip" ? 0.15 : mode === "bulk" ? 0.04 : 0.02;
  return Number((base + payloadSize / 1e4).toFixed(4));
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function inferOneCsCreditScore(payload) {
  return toFiniteNumber(payload.creditScore) ?? toFiniteNumber(payload.rawCreditScore) ?? null;
}
function inferOneCsCompletenessScore(payload) {
  const candidate = toFiniteNumber(payload.completenessScore) ?? toFiniteNumber(payload.dataCompletenessScore);
  if (candidate === null) {
    return void 0;
  }
  return Math.min(1, Math.max(0, candidate));
}
function inferOneCsAdverseReasons(payload, creditScore) {
  const explicitReasons = toStringArray(payload.adverseReasons);
  if (explicitReasons.length > 0) {
    return explicitReasons;
  }
  const inferred = /* @__PURE__ */ new Set();
  if (payload.noCreditProfile === true) {
    inferred.add("Unable to find credit profile at TransUnion");
  }
  if (payload.thinFile === true) {
    inferred.add("Insufficient length of credit history");
  }
  if (payload.highUtilization === true) {
    inferred.add("Proportion of balances to credit limits on bank/national revolving or other revolving accounts is too high");
  }
  if (payload.highDebtToIncome === true) {
    inferred.add("High debt in relation to income");
  }
  if (payload.recentInquiries === true) {
    inferred.add("RiskView Consumer Inquiry");
  }
  if (creditScore === null && inferred.size === 0) {
    inferred.add("Insufficient credit history");
  } else if (creditScore !== null) {
    if (creditScore < 480) {
      inferred.add("Serious delinquency, and public record or collection filed");
      inferred.add("High debt in relation to income");
    } else if (creditScore < 560) {
      inferred.add("Serious delinquency");
      inferred.add("Too many accounts with balances");
      inferred.add("Proportion of balances to credit limits on bank/national revolving or other revolving accounts is too high");
    } else if (creditScore < 640) {
      inferred.add("Income or credit history insufficient for loan");
      inferred.add("Requested amount unsupported by income");
    } else if (creditScore < 720) {
      inferred.add("RiskView Consumer Inquiry");
    }
  }
  return Array.from(inferred);
}
function inferOneCsPriceUsd(mode, payload, estimatedCostUsd) {
  const explicitPrice = toFiniteNumber(payload.priceUsd) ?? toFiniteNumber(payload.chargedPriceUsd) ?? toFiniteNumber(payload.requestPriceUsd);
  if (explicitPrice !== null) {
    return explicitPrice;
  }
  const defaults = {
    single: 1.9,
    bulk: 1.7,
    vip: 2.5
  };
  return Number(Math.max(defaults[mode], estimatedCostUsd * 2.75).toFixed(2));
}
function buildApiResponse(requestId, data, meta) {
  return {
    ok: true,
    requestId,
    data,
    meta
  };
}
function buildApiError(requestId, code, message, retryable = false, details) {
  return {
    ok: false,
    requestId,
    error: {
      code,
      message,
      retryable,
      details
    }
  };
}
async function getAdminOverview() {
  const summary = await getDashboardSummary();
  const [plans2, subscriptions2, payments2, auditTrail2] = await Promise.all([
    listPlans(),
    listSubscriptions(),
    listPayments(),
    listAuditTrailEntries()
  ]);
  return {
    ...summary,
    plans: plans2,
    subscriptions: subscriptions2,
    payments: payments2,
    auditTrail: auditTrail2.slice(0, 50),
    safeTestScenarios: SAFE_TEST_SCENARIOS
  };
}
async function getJobsModule() {
  const jobs2 = await listJobs();
  const enriched = await Promise.all(
    jobs2.map(async (job) => ({
      ...job,
      events: await listJobEventsByJobId(job.id)
    }))
  );
  return enriched;
}
async function getJobDetails(publicId) {
  const job = await getJobByPublicId(publicId);
  if (!job) {
    return null;
  }
  const events = await listJobEventsByJobId(job.id);
  return {
    job,
    events
  };
}
async function getProxyModule() {
  const [providers, policies] = await Promise.all([listProxyProviders(), listProxyPolicies()]);
  const providerHealth = providers.map((provider) => ({
    code: provider.code,
    name: provider.name,
    status: provider.status,
    priority: provider.priority,
    protocolSupport: provider.protocolSupport,
    sessionSupport: provider.sessionSupport,
    costPerGbUsd: provider.costPerGbUsd,
    healthScore: provider.status === "healthy" ? 0.98 : provider.status === "degraded" ? 0.72 : 0.1,
    lastCheckedAt: nowIso()
  }));
  return {
    providers,
    policies,
    providerHealth,
    routingPrinciples: {
      selectionOrder: providers.sort((a, b) => a.priority - b.priority).map((provider) => provider.code),
      fallbackEnabled: true,
      stickySupported: true,
      rotatingSupported: true,
      trafficAccounting: true
    }
  };
}
async function getWorkersModule() {
  const workers = await listWorkerNodes();
  return {
    workers,
    queueHealth: MOCK_HEALTH_SUMMARY.queues,
    recommendations: [
      "Keep VIP queue lag under 10 seconds.",
      "Trigger maintenance mode when heartbeat gap exceeds 60 seconds.",
      "Use safe test scenarios before changing routing or retry policies."
    ]
  };
}
async function getBillingModule() {
  const [plans2, subscriptions2, payments2, apiKeys2] = await Promise.all([
    listPlans(),
    listSubscriptions(),
    listPayments(),
    listApiKeysForUser()
  ]);
  return {
    plans: plans2,
    subscriptions: subscriptions2,
    payments: payments2,
    apiKeys: apiKeys2,
    usageSummary: getRuntimeUsageSummary() ?? MOCK_USAGE_SUMMARY
  };
}
async function getRevenueAnalyticsModule() {
  const [plans2, subscriptions2, payments2] = await Promise.all([
    listPlans(),
    listSubscriptions(),
    listPayments()
  ]);
  const usageSummary = getRuntimeUsageSummary() ?? MOCK_USAGE_SUMMARY;
  const planById = new Map(plans2.map((plan) => [plan.id, plan]));
  const subscriptionById = new Map(subscriptions2.map((subscription) => [subscription.id, subscription]));
  const settledStatuses = /* @__PURE__ */ new Set(["paid", "confirmed"]);
  const refundedStatuses = /* @__PURE__ */ new Set(["refunded"]);
  const pendingStatuses = /* @__PURE__ */ new Set(["pending"]);
  const normalizedPayments = payments2.map((payment) => {
    const normalizedAmountUsd = toFiniteNumber(payment.amountUsd) ?? (payment.currency?.toUpperCase() === "USD" ? toFiniteNumber(payment.amount) : null) ?? 0;
    const effectiveDate = payment.paidAt ?? payment.createdAt ?? /* @__PURE__ */ new Date();
    const periodKey = getCurrentPeriodKey(effectiveDate);
    const subscription = payment.subscriptionId ? subscriptionById.get(payment.subscriptionId) ?? null : null;
    const plan = subscription ? planById.get(subscription.planId) ?? null : null;
    return {
      ...payment,
      normalizedAmountUsd,
      effectiveDate,
      periodKey,
      subscription,
      plan
    };
  });
  const totalCollectedUsd = normalizedPayments.filter((payment) => settledStatuses.has(payment.status)).reduce((sum, payment) => sum + payment.normalizedAmountUsd, 0);
  const refundedUsd = normalizedPayments.filter((payment) => refundedStatuses.has(payment.status)).reduce((sum, payment) => sum + payment.normalizedAmountUsd, 0);
  const pendingUsd = normalizedPayments.filter((payment) => pendingStatuses.has(payment.status)).reduce((sum, payment) => sum + payment.normalizedAmountUsd, 0);
  const activeSubscriptions = subscriptions2.filter(
    (subscription) => ["active", "paid", "confirmed", "trialing"].includes(String(subscription.status))
  );
  const estimatedMrrUsd = activeSubscriptions.reduce((sum, subscription) => {
    const plan = planById.get(subscription.planId);
    if (!plan) {
      return sum;
    }
    const planPriceUsd = toFiniteNumber(plan.priceUsd) ?? 0;
    const divisor = plan.billingInterval === "yearly" ? 12 : plan.billingInterval === "quarterly" ? 3 : plan.billingInterval === "monthly" ? 1 : 0;
    if (!divisor) {
      return sum;
    }
    return sum + planPriceUsd / divisor;
  }, 0);
  const revenueByMonthMap = normalizedPayments.reduce((acc, payment) => {
    const current = acc.get(payment.periodKey) ?? {
      periodKey: payment.periodKey,
      collectedUsd: 0,
      refundedUsd: 0,
      pendingUsd: 0,
      paymentCount: 0
    };
    if (settledStatuses.has(payment.status)) {
      current.collectedUsd += payment.normalizedAmountUsd;
    }
    if (refundedStatuses.has(payment.status)) {
      current.refundedUsd += payment.normalizedAmountUsd;
    }
    if (pendingStatuses.has(payment.status)) {
      current.pendingUsd += payment.normalizedAmountUsd;
    }
    current.paymentCount += 1;
    acc.set(payment.periodKey, current);
    return acc;
  }, /* @__PURE__ */ new Map());
  const revenueByMonth = Array.from(revenueByMonthMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey)).slice(-12).map((item) => ({
    ...item,
    collectedUsd: Number(item.collectedUsd.toFixed(2)),
    refundedUsd: Number(item.refundedUsd.toFixed(2)),
    pendingUsd: Number(item.pendingUsd.toFixed(2))
  }));
  const providerBreakdown = Array.from(
    normalizedPayments.reduce((acc, payment) => {
      const key = payment.provider || "unknown";
      const current = acc.get(key) ?? {
        provider: key,
        collectedUsd: 0,
        refundedUsd: 0,
        pendingUsd: 0,
        paymentCount: 0
      };
      if (settledStatuses.has(payment.status)) {
        current.collectedUsd += payment.normalizedAmountUsd;
      }
      if (refundedStatuses.has(payment.status)) {
        current.refundedUsd += payment.normalizedAmountUsd;
      }
      if (pendingStatuses.has(payment.status)) {
        current.pendingUsd += payment.normalizedAmountUsd;
      }
      current.paymentCount += 1;
      acc.set(key, current);
      return acc;
    }, /* @__PURE__ */ new Map()).values()
  ).sort((a, b) => b.collectedUsd - a.collectedUsd).map((item) => ({
    ...item,
    collectedUsd: Number(item.collectedUsd.toFixed(2)),
    refundedUsd: Number(item.refundedUsd.toFixed(2)),
    pendingUsd: Number(item.pendingUsd.toFixed(2))
  }));
  const planBreakdown = Array.from(
    normalizedPayments.reduce((acc, payment) => {
      const plan = payment.plan;
      const key = plan?.code ?? "unmapped";
      const current = acc.get(key) ?? {
        planCode: key,
        planName: plan?.name ?? "Unmapped",
        tier: plan?.tier ?? "unknown",
        collectedUsd: 0,
        paymentCount: 0,
        activeSubscriptions: 0
      };
      if (settledStatuses.has(payment.status)) {
        current.collectedUsd += payment.normalizedAmountUsd;
      }
      current.paymentCount += 1;
      acc.set(key, current);
      return acc;
    }, /* @__PURE__ */ new Map()).entries()
  ).reduce((acc, [key, value]) => {
    const activeForPlan = activeSubscriptions.filter((subscription) => {
      const plan = planById.get(subscription.planId);
      return (plan?.code ?? "unmapped") === key;
    }).length;
    acc.push({
      ...value,
      activeSubscriptions: activeForPlan,
      collectedUsd: Number(value.collectedUsd.toFixed(2))
    });
    return acc;
  }, []).sort((a, b) => b.collectedUsd - a.collectedUsd);
  const recentPayments = normalizedPayments.slice(0, 12).map((payment) => ({
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    currency: payment.currency,
    amount: payment.amount,
    amountUsd: Number(payment.normalizedAmountUsd.toFixed(2)),
    planCode: payment.plan?.code ?? null,
    planName: payment.plan?.name ?? null,
    tier: payment.plan?.tier ?? null,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt ?? payment.effectiveDate,
    invoiceRef: payment.invoiceRef,
    txRef: payment.txRef
  }));
  return {
    overview: {
      totalCollectedUsd: Number(totalCollectedUsd.toFixed(2)),
      refundedUsd: Number(refundedUsd.toFixed(2)),
      pendingUsd: Number(pendingUsd.toFixed(2)),
      estimatedMrrUsd: Number(estimatedMrrUsd.toFixed(2)),
      activeSubscriptions: activeSubscriptions.length,
      totalPayments: normalizedPayments.length,
      usageRevenueUsd: Number((usageSummary?.revenueUsd ?? 0).toFixed(2)),
      usageMarginUsd: Number((usageSummary?.marginUsd ?? 0).toFixed(2)),
      usageCogsUsd: Number((usageSummary?.cogsUsd ?? 0).toFixed(2)),
      currentPeriod: usageSummary?.currentPeriod ?? getCurrentPeriodKey()
    },
    usageSummary,
    revenueByMonth,
    providerBreakdown,
    planBreakdown,
    recentPayments
  };
}
async function getOperatorLogsModule() {
  const [jobs2, auditTrail2] = await Promise.all([
    listJobs(),
    listAuditTrailEntries()
  ]);
  const recentJobs = jobs2.slice(0, 40);
  const jobEventGroups = await Promise.all(
    recentJobs.map(async (job) => {
      const events = await listJobEventsByJobId(job.id);
      return events.map((event) => ({
        id: `job-${job.publicId}-${event.id}`,
        source: "job_event",
        severity: event.severity,
        title: event.eventType,
        message: event.message,
        resourceType: "job",
        resourceId: job.publicId,
        actorLabel: job.source,
        createdAt: event.createdAt,
        details: event.eventJson
      }));
    })
  );
  const auditEntries = auditTrail2.map((entry) => ({
    id: `audit-${entry.id}`,
    source: "audit",
    severity: entry.status === "failure" ? "error" : entry.status === "denied" ? "warn" : "info",
    title: entry.action,
    message: `${entry.actorType} \u2192 ${entry.resourceType} \xB7 ${entry.resourceId}`,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    actorLabel: entry.actorType,
    createdAt: entry.createdAt,
    status: entry.status,
    ipAddress: entry.ipAddress,
    details: entry.detailsJson
  }));
  const timeline = [...auditEntries, ...jobEventGroups.flat()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 200);
  const counters = timeline.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc.sources[entry.source] = (acc.sources[entry.source] ?? 0) + 1;
      acc.severity[entry.severity] = (acc.severity[entry.severity] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      sources: {},
      severity: {}
    }
  );
  return {
    counters,
    timeline,
    jobsInspected: recentJobs.length,
    auditEntries: auditTrail2.length
  };
}
async function getTelemetryModule() {
  const [jobs2, providers, workers, auditTrail2] = await Promise.all([
    listJobs(),
    listProxyProviders(),
    listWorkerNodes(),
    listAuditTrailEntries()
  ]);
  const counts = jobs2.reduce(
    (acc, job) => {
      acc.total += 1;
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
      waiting_retry: 0
    }
  );
  const successRate = counts.total > 0 ? counts.succeeded / counts.total : 0;
  const retryRate = counts.total > 0 ? counts.waiting_retry / counts.total : 0;
  return {
    health: MOCK_HEALTH_SUMMARY,
    jobStatusCounts: counts,
    successRate,
    retryRate,
    providers,
    workers,
    recentAudit: auditTrail2.slice(0, 20)
  };
}
async function getSystemModule() {
  const stabilizationChecklist = [
    "Rate limit all public REST endpoints.",
    "Emit audit events for administrative mutations.",
    "Keep proxy fallback paths observable in job events.",
    "Never execute external protected flows from the safe test bench."
  ];
  return {
    health: MOCK_HEALTH_SUMMARY,
    safeTestScenarios: SAFE_TEST_SCENARIOS,
    stabilizationChecklist,
    readinessSnapshot: [
      {
        code: "safe-bench-isolation",
        label: "Safe bench isolation",
        status: "ready",
        detail: "External protected flows stay excluded from the operator test bench."
      },
      {
        code: "proxy-fallback-observability",
        label: "Proxy fallback observability",
        status: "ready",
        detail: "Fallback paths are visible through job events and telemetry summaries."
      },
      {
        code: "admin-audit-mutations",
        label: "Admin mutation audit trail",
        status: "pending",
        detail: "Administrative write actions still need explicit audit coverage before wider rollout."
      },
      {
        code: "public-rest-rate-limits",
        label: "Public REST rate limits",
        status: "pending",
        detail: "Production-facing public endpoints still require final hardening and verification."
      }
    ],
    rolloutRunbook: [
      "Confirm the health snapshot and queue/provider counters before any broader rollout.",
      "Run only safe scenarios first and verify expected operator-facing UI text for each path.",
      "Promote changes incrementally after automated checks, manual verification and checkpoint creation."
    ],
    rollbackRunbook: [
      "Stop at the first degraded signal in health, logs or payment-sensitive operator flows.",
      "Rollback to the latest confirmed checkpoint and re-verify Overview, Metrics and Billing screens.",
      "Keep the previous stable runtime path available until the corrective increment is confirmed visually."
    ]
  };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function executeThroughProxy(lease, timeoutMs) {
  const httpMod = __require("http");
  return new Promise((resolve) => {
    const req = httpMod.request(
      {
        method: "GET",
        hostname: "api.ipify.org",
        port: 443,
        path: "/?format=text",
        host: `${lease.host}:${lease.port}`,
        proxy: `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`,
        timeout: timeoutMs,
        headers: {
          Host: "api.ipify.org",
          "User-Agent": "ONE-CS-ProxyCheck/1.0"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          const ip = data.trim();
          if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            resolve(null);
          } else {
            resolve("PROXY_IP_UNEXPECTED_FORMAT");
          }
        });
      }
    );
    req.on("error", (err) => {
      resolve(err.code ?? "TRANSPORT_ERROR");
    });
    req.on("timeout", () => {
      req.destroy();
      resolve("CONNECTION_TIMEOUT");
    });
    req.end();
  });
}
async function executeQueuedJobLifecycle(params) {
  const { job, input, actor, providerHint, fallbackProvider, durationMs, oneCsResult, summary, proxyLease } = params;
  const startedAt = /* @__PURE__ */ new Date();
  await updateJobRecord(job.publicId, {
    status: input.payload.simulateRetryableError === true ? "waiting_retry" : "running",
    startedAt,
    attemptCount: 1,
    workerNodeId: 1
  });
  await persistJobEvents([
    {
      jobId: job.id,
      eventType: input.payload.simulateRetryableError === true ? "job.waiting_retry" : "worker.started",
      severity: input.payload.simulateRetryableError === true ? "warn" : "info",
      message: input.payload.simulateRetryableError === true ? `Job ${job.publicId} entered retry wait state after first dispatch attempt.` : `Worker picked up job ${job.publicId} from queue ${job.queueName}.`,
      eventJson: input.payload.simulateRetryableError === true ? { retryable: true, nextAttempt: 2, providerHint } : { workerNodeId: 1, providerHint, actorSource: actor.source },
      createdAt: startedAt
    }
  ]);
  await persistWorkerRun({
    jobId: job.id,
    workerNodeId: 1,
    runStatus: input.payload.simulateRetryableError === true ? "failed" : "started",
    attemptNumber: 1,
    profilePolicy: input.profilePolicy ?? null,
    fingerprintProfile: input.fingerprintProfile ?? null,
    runtimeMs: input.payload.simulateRetryableError === true ? Math.round(durationMs * 0.35) : null,
    detailsJson: {
      executionMode: "queued_runtime",
      providerUsed: proxyLease?.provider ?? providerHint,
      proxyHost: proxyLease?.host ?? null,
      proxyPort: proxyLease?.port ?? null,
      sessionKey: proxyLease?.sessionKey ?? null,
      fallbackProvider,
      safeTestMode: false
    },
    createdAt: startedAt,
    finishedAt: input.payload.simulateRetryableError === true ? new Date(startedAt.getTime() + Math.round(durationMs * 0.35)) : null
  });
  if (input.payload.simulateRetryableError === true) {
    await sleep(350);
    if (proxyLease) {
      await releaseProxy({
        leaseId: proxyLease.leaseId,
        success: true,
        bytesSent: Math.max(256, Math.round(durationMs * 0.35 / 100)),
        bytesReceived: Math.max(512, Math.round(durationMs * 0.35 / 50))
      });
    }
    const completedAt2 = /* @__PURE__ */ new Date();
    const resultJson2 = {
      mode: input.requestMode,
      safeTestMode: false,
      providerUsed: providerHint,
      fallbackPrepared: true,
      recoveredAfterRetry: true,
      completedAt: completedAt2.toISOString(),
      executionState: "completed_after_retry",
      oneCsResult,
      summary
    };
    await updateJobRecord(job.publicId, {
      status: "succeeded",
      resultJson: resultJson2,
      errorCode: null,
      errorMessage: null,
      attemptCount: 2,
      completedAt: completedAt2
    });
    await persistJobEvents([
      {
        jobId: job.id,
        eventType: "worker.retried",
        severity: "info",
        message: `Job ${job.publicId} succeeded on retry attempt with provider ${providerHint}.`,
        eventJson: { attemptNumber: 2, providerHint, fallbackProvider },
        createdAt: completedAt2
      },
      {
        jobId: job.id,
        eventType: "job.completed",
        severity: "info",
        message: `Job ${job.publicId} completed after retry recovery.`,
        eventJson: { durationMs, status: oneCsResult.status },
        createdAt: completedAt2
      }
    ]);
    await persistWorkerRun({
      jobId: job.id,
      workerNodeId: 1,
      runStatus: "completed",
      attemptNumber: 2,
      profilePolicy: input.profilePolicy ?? null,
      fingerprintProfile: input.fingerprintProfile ?? null,
      runtimeMs: durationMs,
      detailsJson: {
        executionMode: "queued_runtime",
        retried: true,
        providerUsed: proxyLease?.provider ?? providerHint,
        proxyHost: proxyLease?.host ?? null,
        proxyPort: proxyLease?.port ?? null,
        sessionKey: proxyLease?.sessionKey ?? null
      },
      createdAt: completedAt2,
      finishedAt: completedAt2
    });
    if (proxyLease) {
      await releaseProxy({ leaseId: proxyLease.leaseId, success: true });
    }
    return;
  }
  let httpExecutionError = null;
  if (proxyLease && !input.payload.simulateRetryableError) {
    httpExecutionError = await executeThroughProxy(proxyLease, durationMs);
  }
  await sleep(250);
  const completedAt = /* @__PURE__ */ new Date();
  const resultJson = {
    mode: input.requestMode,
    safeTestMode: false,
    providerUsed: proxyLease?.provider ?? providerHint,
    fallbackPrepared: true,
    completedAt: completedAt.toISOString(),
    executionState: httpExecutionError ? `proxy_error:${httpExecutionError}` : "completed_by_worker",
    oneCsResult,
    summary,
    proxyHost: proxyLease?.host ?? null,
    proxyPort: proxyLease?.port ?? null,
    sessionKey: proxyLease?.sessionKey ?? null,
    assignedIp: proxyLease?.assignedIp ?? null
  };
  await updateJobRecord(job.publicId, {
    status: "succeeded",
    resultJson,
    errorCode: null,
    errorMessage: null,
    completedAt
  });
  await persistJobEvents([
    {
      jobId: job.id,
      eventType: "worker.completed",
      severity: "info",
      message: `Worker completed job ${job.publicId}.`,
      eventJson: { durationMs, providerHint },
      createdAt: completedAt
    },
    {
      jobId: job.id,
      eventType: "job.completed",
      severity: "info",
      message: `Job ${job.publicId} completed in queued runtime mode.`,
      eventJson: { durationMs, status: oneCsResult.status },
      createdAt: completedAt
    },
    ...httpExecutionError ? [{
      jobId: job.id,
      eventType: "proxy.execution_error",
      severity: "warn",
      message: `HTTP execution through proxy failed: ${httpExecutionError}`,
      eventJson: { errorCode: httpExecutionError, leaseId: proxyLease?.leaseId ?? null, proxyHost: proxyLease?.host ?? null },
      createdAt: completedAt
    }] : []
  ]);
  await persistWorkerRun({
    jobId: job.id,
    workerNodeId: 1,
    runStatus: "completed",
    attemptNumber: 1,
    profilePolicy: input.profilePolicy ?? null,
    fingerprintProfile: input.fingerprintProfile ?? null,
    runtimeMs: durationMs,
    detailsJson: {
      executionMode: "queued_runtime",
      providerUsed: proxyLease?.provider ?? providerHint,
      proxyHost: proxyLease?.host ?? null,
      proxyPort: proxyLease?.port ?? null,
      sessionKey: proxyLease?.sessionKey ?? null,
      fallbackProvider
    },
    createdAt: completedAt,
    finishedAt: completedAt
  });
  if (proxyLease) {
    await releaseProxy({
      leaseId: proxyLease.leaseId,
      success: httpExecutionError === null,
      errorCode: httpExecutionError ?? void 0,
      bytesSent: Math.max(256, Math.round(durationMs / 100)),
      bytesReceived: Math.max(512, Math.round(durationMs / 50))
    });
    if (httpExecutionError) {
      console.warn(
        `[ONE CS] Job ${job.publicId} HTTP execution failed: ${httpExecutionError} via ${proxyLease.provider} ${proxyLease.host}:${proxyLease.port}`
      );
    } else {
      console.info(
        `[ONE CS] Job ${job.publicId} completed via ${proxyLease.provider} ${proxyLease.host}:${proxyLease.port} (session=${proxyLease.sessionKey}) in ${durationMs}ms.`
      );
    }
  }
}
async function createSingleJob(input, actor) {
  const requestId = createPublicId("req");
  const publicId = createPublicId("job");
  const payloadSize = JSON.stringify(input.payload).length;
  const estimatedCostUsd = estimateCost(input.requestMode, payloadSize);
  const now = /* @__PURE__ */ new Date();
  const safeTestMode = input.safeTestMode === true;
  const baseStatus = safeTestMode ? "succeeded" : "queued";
  const providerHint = input.proxy?.providerHint ?? "evomi";
  const fallbackProvider = providerHint === "evomi" ? "dataimpulse" : "evomi";
  const payloadRecord = input.payload;
  const creditScore = inferOneCsCreditScore(payloadRecord);
  const completenessScore = inferOneCsCompletenessScore(payloadRecord);
  const adverseReasons = inferOneCsAdverseReasons(payloadRecord, creditScore);
  const durationMs = Math.round(
    toFiniteNumber(payloadRecord.durationMs) ?? (input.requestMode === "vip" ? 28e3 : input.requestMode === "bulk" ? 24e3 : 19e3)
  );
  const oneCsResult = buildOneCsResult({
    creditScore,
    completenessScore,
    adverseReasons,
    priceUsd: inferOneCsPriceUsd(input.requestMode, payloadRecord, estimatedCostUsd),
    durationMs,
    source: actor.source
  });
  const summary = {
    creditScore: oneCsResult.creditScore,
    productScore: oneCsResult.productScore,
    dataQualityScore: oneCsResult.dataQualityScore,
    status: oneCsResult.status,
    adverseReasonCount: oneCsResult.adverseReasons.length
  };
  const resultJson = safeTestMode ? {
    mode: input.requestMode,
    safeTestMode: true,
    providerUsed: providerHint,
    fallbackPrepared: true,
    extractedAt: nowIso(),
    oneCsResult,
    summary
  } : {
    mode: input.requestMode,
    safeTestMode: false,
    providerUsed: providerHint,
    fallbackPrepared: true,
    queuedAt: nowIso(),
    executionState: "queued_for_worker",
    summary
  };
  const job = await persistJobRecord({
    publicId,
    userId: actor.userId ?? null,
    apiKeyId: null,
    source: actor.source,
    requestMode: input.requestMode,
    status: baseStatus,
    queueName: input.queueName,
    priority: input.priority,
    targetLabel: input.targetLabel ?? null,
    payloadJson: input.payload,
    resultJson,
    errorCode: null,
    errorMessage: null,
    proxyPolicyId: null,
    workerNodeId: 1,
    attemptCount: safeTestMode ? 1 : 0,
    maxAttempts: input.proxy?.maxTransportRetries ? input.proxy.maxTransportRetries + 1 : 3,
    costEstimateUsd: estimatedCostUsd.toFixed(4),
    cogsUsd: (estimatedCostUsd * 0.55).toFixed(4),
    createdAt: now,
    startedAt: safeTestMode ? now : null,
    completedAt: safeTestMode ? now : null
  });
  const events = [
    {
      type: "job.created",
      severity: "info",
      message: `Job ${publicId} created in ${safeTestMode ? "safe test" : "queued runtime"} mode.`,
      details: {
        requestMode: input.requestMode,
        queueName: input.queueName,
        providerHint
      }
    },
    {
      type: "proxy.selection",
      severity: "info",
      message: `Primary provider selected: ${providerHint}.`,
      details: {
        providerHint,
        fallbackProvider,
        sessionMode: input.proxy?.sessionMode ?? "rotating"
      }
    }
  ];
  if (safeTestMode) {
    events.push({
      type: "job.completed",
      severity: "info",
      message: `Job ${publicId} completed inside the safe test bench.`,
      details: {
        durationMs,
        status: oneCsResult.status
      }
    });
  } else {
    events.push({
      type: "job.queued",
      severity: "info",
      message: `Job ${publicId} accepted into queue ${input.queueName}.`,
      details: {
        queueName: input.queueName,
        maxAttempts: input.proxy?.maxTransportRetries ? input.proxy.maxTransportRetries + 1 : 3
      }
    });
  }
  if (input.payload.simulateProviderFailure === true) {
    events.push({
      type: "proxy.provider_fallback",
      severity: "warn",
      message: `Primary provider ${providerHint} marked degraded, fallback prepared: ${fallbackProvider}.`,
      details: { from: providerHint, to: fallbackProvider }
    });
  }
  if (input.payload.simulateRetryableError === true) {
    events.push({
      type: "job.waiting_retry",
      severity: "warn",
      message: "Retryable error simulated for stability validation.",
      details: { retryable: true, nextAttempt: 2 }
    });
  }
  await persistJobEvents(
    events.map((event) => ({
      jobId: job.id,
      eventType: event.type,
      severity: event.severity,
      message: event.message,
      eventJson: event.details,
      createdAt: now
    }))
  );
  const savedEvents = await listJobEventsByJobId(job.id);
  const apiEvents = savedEvents.map((event) => ({
    id: event.id,
    jobId: event.jobId,
    type: event.eventType,
    severity: event.severity,
    message: event.message,
    details: event.eventJson,
    createdAt: event.createdAt
  }));
  let proxyLease = null;
  if (!safeTestMode) {
    proxyLease = await acquireProxy({
      userId: actor.userId ?? void 0,
      jobPublicId: publicId,
      source: actor.source
    });
  }
  const proxyEndpointHost = proxyLease ? proxyLease.host : `${providerHint}.proxy.internal`;
  const proxyEndpointPort = proxyLease ? proxyLease.port : input.proxy?.protocol === "socks5" ? 1080 : 9e3;
  const proxySessionKey = proxyLease ? proxyLease.sessionKey : safeTestMode ? `safe_${publicId}` : `queue_${publicId}`;
  await persistProxyLease({
    leaseId: proxyLease?.leaseId ?? createPublicId("lease"),
    jobId: job.id,
    workerNodeId: 1,
    providerId: proxyLease ? proxyLease.provider === "evomi" ? 1 : 2 : providerHint === "dataimpulse" ? 2 : 1,
    policyId: null,
    protocol: input.proxy?.protocol ?? "http",
    sessionMode: input.proxy?.sessionMode ?? "sticky",
    sessionKey: proxySessionKey,
    endpointHost: proxyEndpointHost,
    endpointPort: proxyEndpointPort,
    country: proxyLease?.country ?? input.proxy?.country ?? null,
    status: safeTestMode ? "released" : "active",
    bytesSent: Math.max(256, payloadSize),
    bytesReceived: Math.max(512, Math.round(payloadSize * 1.5)),
    estimatedCostUsd: proxyLease?.estimatedCostUsd.toFixed(4) ?? estimatedCostUsd.toFixed(4),
    lastErrorCode: input.payload.simulateProviderFailure === true ? "PROVIDER_DEGRADED" : null,
    metadataJson: {
      providerUsed: proxyLease?.provider ?? providerHint,
      fallbackPrepared: true,
      targetLabel: input.targetLabel ?? null,
      leaseId: proxyLease?.leaseId ?? null,
      sessionKey: proxySessionKey,
      rotateAfterN: proxyLease?.rotateAfterN ?? 20
    },
    createdAt: now,
    expiresAt: safeTestMode ? now : proxyLease?.expiresAt ?? new Date(now.getTime() + 15 * 60 * 1e3),
    releasedAt: safeTestMode ? now : null
  });
  if (safeTestMode) {
    await persistWorkerRun({
      jobId: job.id,
      workerNodeId: 1,
      runStatus: "completed",
      attemptNumber: 1,
      profilePolicy: input.profilePolicy ?? null,
      fingerprintProfile: input.fingerprintProfile ?? null,
      runtimeMs: durationMs,
      detailsJson: {
        safeTestMode: true,
        providerUsed: providerHint
      },
      createdAt: now,
      finishedAt: now
    });
  }
  const unitCostUsd = estimatedCostUsd;
  const revenueUsd = inferOneCsPriceUsd(input.requestMode, payloadRecord, estimatedCostUsd);
  await persistUsageRecord({
    userId: actor.userId ?? null,
    apiKeyId: null,
    jobId: job.id,
    metricType: input.requestMode === "bulk" ? "bulk_item" : "request",
    quantity: "1.0000",
    unitCostUsd: unitCostUsd.toFixed(4),
    totalCostUsd: unitCostUsd.toFixed(4),
    periodKey: getCurrentPeriodKey(now),
    metadataJson: {
      requestMode: input.requestMode,
      revenueUsd,
      safeTestMode
    },
    createdAt: now
  });
  if (input.requestMode === "vip") {
    await persistUsageRecord({
      userId: actor.userId ?? null,
      apiKeyId: null,
      jobId: job.id,
      metricType: "browser_run",
      quantity: "1.0000",
      unitCostUsd: "0.0000",
      totalCostUsd: "0.0000",
      periodKey: getCurrentPeriodKey(now),
      metadataJson: {
        source: actor.source,
        safeTestMode
      },
      createdAt: now
    });
  }
  await persistAuditTrailEntry({
    actorUserId: actor.userId ?? null,
    actorType: actor.source === "api" ? "api_key" : "user",
    action: "job.create",
    resourceType: "job",
    resourceId: publicId,
    status: "success",
    ipAddress: null,
    detailsJson: {
      requestMode: input.requestMode,
      queueName: input.queueName,
      safeTestMode,
      providerHint
    },
    createdAt: now
  });
  if (!safeTestMode) {
    void executeQueuedJobLifecycle({
      job,
      input,
      actor,
      providerHint,
      fallbackProvider,
      durationMs,
      oneCsResult,
      summary,
      proxyLease
    }).catch((error) => {
      console.error(`[ONE CS] queued job lifecycle failed for ${job.publicId}`, error);
    });
  }
  return buildApiResponse(requestId, { job, events: apiEvents }, {
    safeTestMode,
    persisted: true,
    executionMode: safeTestMode ? "safe_test" : "queued_runtime"
  });
}
async function createBulkJob(input, actor) {
  const requestId = createPublicId("req");
  const items = input.items.map((item, index2) => {
    const syntheticInput = {
      requestMode: "bulk",
      queueName: input.queueName,
      priority: input.priority,
      payload: item.payload,
      proxy: input.proxy,
      safeTestMode: input.safeTestMode,
      targetLabel: item.externalId ?? `bulk-item-${index2 + 1}`
    };
    return createSingleJob(syntheticInput, actor);
  });
  const resolved = await Promise.all(items);
  return buildApiResponse(
    requestId,
    {
      batchId: createPublicId("batch"),
      itemCount: resolved.length,
      jobs: resolved.map((result) => result.data.job)
    },
    {
      safeTestMode: input.safeTestMode,
      queueName: input.queueName
    }
  );
}
async function createApiKeyRecord(userId, input) {
  const rawToken = `cs_${input.scope}_${randomBytes2(18).toString("hex")}`;
  const keyPrefix = rawToken.slice(0, 16);
  const now = /* @__PURE__ */ new Date();
  const record = await persistApiKeyRecord({
    userId,
    label: input.label,
    keyPrefix,
    keyHash: hashToken(rawToken),
    scope: input.scope,
    status: "active",
    rpmLimit: input.rpmLimit,
    dailyLimit: input.dailyLimit,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    lastUsedAt: null
  });
  await persistAuditTrailEntry({
    actorUserId: userId,
    actorType: "user",
    action: "apikey.create",
    resourceType: "api_key",
    resourceId: keyPrefix,
    status: "success",
    ipAddress: null,
    detailsJson: {
      scope: input.scope,
      rpmLimit: input.rpmLimit,
      dailyLimit: input.dailyLimit
    },
    createdAt: now
  });
  return {
    preview: rawToken,
    record
  };
}
async function listUserApiKeys(userId) {
  return listApiKeysForUser(userId);
}
async function revokeUserApiKey(userId, id) {
  const existing = (await listApiKeysForUser(userId)).find((apiKey) => apiKey.id === id);
  if (!existing) {
    throw new Error("API key not found");
  }
  if (existing.status === "revoked") {
    return existing;
  }
  const revoked = await revokeApiKeyRecord(id);
  if (!revoked) {
    throw new Error("Failed to revoke API key");
  }
  await persistAuditTrailEntry({
    actorUserId: userId,
    actorType: "user",
    action: "apikey.revoke",
    resourceType: "api_key",
    resourceId: revoked.keyPrefix,
    status: "success",
    ipAddress: null,
    detailsJson: {
      scope: revoked.scope,
      previousStatus: existing.status,
      nextStatus: revoked.status
    },
    createdAt: /* @__PURE__ */ new Date()
  });
  return revoked;
}
async function getSafeTestBench() {
  return {
    scenarios: SAFE_TEST_SCENARIOS,
    mockHealth: MOCK_HEALTH_SUMMARY,
    sampleJob: findMockJob("job_mock_success_001"),
    sampleEvents: listMockJobEvents(1),
    guidance: [
      "Use safe test mode for all manual validation before enabling real integrations.",
      "Validate queue transitions, proxy fallback, rate limiting and audit events independently.",
      "Treat all simulated transport failures as opportunities to inspect observability paths.",
      "Redact sensitive imported records before converting them into queue payloads."
    ]
  };
}
async function previewImportedLeadText(inputText) {
  const parsed = parseImportedLeadText(inputText);
  const safeRecords = parsed.map(toSafeImportedLeadRecord);
  const stateBreakdown = safeRecords.reduce((acc, record) => {
    const key = record.state ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return {
    totalRecords: safeRecords.length,
    sourceLabels: Array.from(new Set(safeRecords.map((record) => record.sourceLabel).filter(Boolean))),
    stateBreakdown,
    withPhone: safeRecords.filter((record) => record.phoneNumbers.length > 0).length,
    withEmailDomain: safeRecords.filter((record) => Boolean(record.emailDomain)).length,
    withDob: safeRecords.filter((record) => Boolean(record.dobText)).length,
    withSsnMarker: safeRecords.filter((record) => record.hasSsn).length,
    averageCompletenessScore: safeRecords.length > 0 ? Number(
      (safeRecords.reduce((sum, record) => sum + record.completenessScore, 0) / safeRecords.length).toFixed(2)
    ) : 0,
    sampleRecords: safeRecords.slice(0, 10),
    safePayloads: buildSafeLeadImportPayloads(inputText).slice(0, 25)
  };
}
async function createSafeImportedLeadBatch(inputText, actor) {
  const safePayloads = buildSafeLeadImportPayloads(inputText);
  return createBulkJob(
    {
      queueName: "lead-import",
      priority: 110,
      safeTestMode: true,
      items: safePayloads.map((payload, index2) => ({
        externalId: payload.targetLabel ?? `lead-import-${index2 + 1}`,
        payload: payload.payload
      }))
    },
    actor
  );
}
async function getApiUsageSummary() {
  const apiKeys2 = await listApiKeysForUser();
  return {
    apiKeys: apiKeys2,
    usageSummary: getRuntimeUsageSummary() ?? MOCK_USAGE_SUMMARY
  };
}
function deriveRateLimit(scope) {
  switch (scope) {
    case "admin":
      return { rpm: 600, daily: 1e5 };
    case "vip":
      return { rpm: 300, daily: 25e3 };
    case "bulk":
      return { rpm: 120, daily: 5e3 };
    default:
      return { rpm: 60, daily: 1e3 };
  }
}
var DEFAULT_BOT_TEXT_LIBRARY = [
  {
    key: "maintenanceBanner",
    title: "Maintenance banner",
    description: "\u041A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u0430\u0432\u0430\u0440\u0438\u0439\u043D\u043E\u0433\u043E \u0438\u043B\u0438 \u043F\u043B\u0430\u043D\u043E\u0432\u043E\u0433\u043E \u0431\u0430\u043D\u043D\u0435\u0440\u0430.",
    body: "\u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0432 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443 \u043D\u0435\u043C\u043D\u043E\u0433\u043E \u043F\u043E\u0437\u0436\u0435."
  },
  {
    key: "paymentReminder",
    title: "Payment reminder",
    description: "\u0422\u0435\u043A\u0441\u0442 \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u0435 \u0438\u043B\u0438 \u043F\u0440\u043E\u0434\u043B\u0435\u043D\u0438\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0430.",
    body: "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u043C, \u0447\u0442\u043E \u0441\u0440\u043E\u043A \u043E\u043F\u043B\u0430\u0442\u044B \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442 \u043A \u043A\u043E\u043D\u0446\u0443. \u0415\u0441\u043B\u0438 \u043F\u043B\u0430\u0442\u0451\u0436 \u0443\u0436\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D, \u043F\u0440\u043E\u0441\u0442\u043E \u0434\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F."
  },
  {
    key: "retryNotice",
    title: "Retry notice",
    description: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u043E\u0448\u0438\u0431\u043A\u0438, \u043A\u043E\u0433\u0434\u0430 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u0431\u0443\u0434\u0435\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.",
    body: "\u041C\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0443\u044E \u043E\u0448\u0438\u0431\u043A\u0443 \u0438 \u0443\u0436\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u043B\u0438 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0443\u044E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443. \u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F."
  },
  {
    key: "supportReply",
    title: "Support reply",
    description: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438 \u0434\u043B\u044F \u0440\u0443\u0447\u043D\u044B\u0445 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0441\u043A\u0438\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.",
    body: "\u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0435. \u041C\u044B \u0443\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E \u0438 \u0432\u0435\u0440\u043D\u0451\u043C\u0441\u044F \u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C, \u043A\u0430\u043A \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u043C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u043E \u0432\u0430\u0448\u0435\u043C\u0443 \u043A\u0435\u0439\u0441\u0443."
  },
  {
    key: "welcome",
    title: "Welcome",
    description: "\u041F\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0431\u043E\u0442\u0430 \u0434\u043B\u044F \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439.",
    body: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C. \u0411\u043E\u0442 \u0433\u043E\u0442\u043E\u0432 \u043F\u043E\u043C\u043E\u0447\u044C \u0441 \u0437\u0430\u043F\u0440\u043E\u0441\u0430\u043C\u0438, \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043C\u0438 \u0438 \u0441\u0435\u0440\u0432\u0438\u0441\u043D\u044B\u043C\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F\u043C\u0438."
  }
];
function normalizeChatIds(input) {
  return Array.from(
    new Set(
      input.map((item) => item.trim()).filter(Boolean)
    )
  );
}
async function ensureDefaultBotTexts() {
  const { listBotTextSettings: listBotTextSettings2, upsertBotTextSetting: upsertBotTextSetting2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const existing = await listBotTextSettings2();
  if (existing.length > 0) {
    return existing;
  }
  const now = /* @__PURE__ */ new Date();
  const seeded = await Promise.all(
    DEFAULT_BOT_TEXT_LIBRARY.map(
      (item) => upsertBotTextSetting2({
        key: item.key,
        title: item.title,
        description: item.description,
        body: item.body,
        updatedByUserId: null,
        updatedAt: now
      })
    )
  );
  return seeded;
}
function sortBotTexts(records) {
  return records.slice().sort((a, b) => a.key.localeCompare(b.key));
}
async function resolveBroadcastRecipients(input) {
  const { listTelegramRecipients: listTelegramRecipients2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  if (input.audience === "manual_chat_ids") {
    return normalizeChatIds(input.manualChatIds ?? []).map((chatId) => ({
      chatId,
      label: `manual:${chatId}`,
      source: "manual_chat_ids"
    }));
  }
  const linked = await listTelegramRecipients2({ activeOnly: true });
  return normalizeChatIds(linked.map((item) => item.chatId)).map((chatId) => {
    const recipient = linked.find((item) => item.chatId === chatId);
    return {
      chatId,
      label: recipient ? `${recipient.botLabel} \xB7 ${chatId}` : chatId,
      source: "linked_telegram_users"
    };
  });
}
async function sendTelegramMessage(params) {
  const parseMode = params.parseMode ?? "html";
  const body = {
    chat_id: params.chatId,
    text: params.text,
    disable_web_page_preview: true
  };
  if (parseMode !== "plain") {
    body.parse_mode = parseMode;
  }
  const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API responded with ${response.status}`);
  }
  return {
    ok: true,
    messageId: payload.result?.message_id ?? null
  };
}
async function sendTelegramDocument(params) {
  const parseMode = params.parseMode ?? "html";
  const body = {
    chat_id: params.chatId,
    document: params.url,
    parse_mode: parseMode
  };
  if (params.caption) {
    body.caption = params.caption;
  }
  const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API responded with ${response.status}`);
  }
  return {
    ok: true,
    messageId: payload.result?.message_id ?? null
  };
}
async function getBotTextTemplate(key) {
  const texts = await ensureDefaultBotTexts();
  return texts.find((t2) => t2.key === key) ?? null;
}
async function getBotTextsModule() {
  const texts = sortBotTexts(await ensureDefaultBotTexts());
  const { listTelegramRecipients: listTelegramRecipients2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const recipients = await listTelegramRecipients2();
  return {
    texts,
    recipients,
    summary: {
      totalTemplates: texts.length,
      totalRecipients: recipients.length,
      activeRecipients: recipients.filter((item) => item.status === "active").length,
      telegramConfigured: Boolean(process.env.BOT_TOKEN)
    }
  };
}
async function updateBotTextTemplate(input, actor) {
  const { listBotTextSettings: listBotTextSettings2, persistAuditTrailEntry: persistAuditTrailEntry2, upsertBotTextSetting: upsertBotTextSetting2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const existingRows = await ensureDefaultBotTexts();
  const existing = existingRows.find((item) => item.key === input.key) ?? (await listBotTextSettings2()).find((item) => item.key === input.key) ?? null;
  const now = /* @__PURE__ */ new Date();
  const saved = await upsertBotTextSetting2({
    key: input.key,
    title: input.title?.trim() || existing?.title || input.key,
    description: input.description?.trim() || existing?.description || null,
    body: input.body,
    updatedByUserId: actor.userId,
    updatedAt: now
  });
  await persistAuditTrailEntry2({
    actorUserId: actor.userId,
    actorType: actor.userId ? "user" : "system",
    action: "bot_text.updated",
    resourceType: "bot_text",
    resourceId: input.key,
    status: "success",
    ipAddress: null,
    detailsJson: {
      title: saved.title,
      bodyLength: saved.body.length,
      updatedAt: saved.updatedAt.toISOString()
    },
    createdAt: now
  });
  return saved;
}
async function getBroadcastsModule() {
  const { listRuntimeBroadcasts: listRuntimeBroadcasts2 } = await Promise.resolve().then(() => (init_runtimeStore(), runtimeStore_exports));
  const recipients = await resolveBroadcastRecipients({ audience: "linked_telegram_users" });
  const history = listRuntimeBroadcasts2();
  return {
    recipients,
    history,
    summary: {
      totalBroadcasts: history.length,
      completedBroadcasts: history.filter((item) => item.status === "completed").length,
      failedBroadcasts: history.filter((item) => item.status === "failed").length,
      linkedRecipients: recipients.length,
      telegramConfigured: Boolean(process.env.BOT_TOKEN)
    }
  };
}
async function createBroadcastCampaign(input, actor) {
  const { persistAuditTrailEntry: persistAuditTrailEntry2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const { saveRuntimeBroadcast: saveRuntimeBroadcast2 } = await Promise.resolve().then(() => (init_runtimeStore(), runtimeStore_exports));
  const requestedAt = /* @__PURE__ */ new Date();
  const recipients = await resolveBroadcastRecipients({
    audience: input.audience,
    manualChatIds: input.manualChatIds
  });
  if (recipients.length === 0) {
    throw new Error(
      input.audience === "linked_telegram_users" ? "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 Telegram-\u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u0435\u0439. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 chatId \u0432 telegramEndpoints \u0438\u043B\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 manual chat IDs." : "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D manual chat ID \u0434\u043B\u044F \u0440\u0430\u0441\u0441\u044B\u043B\u043A\u0438."
    );
  }
  const botToken = process.env.BOT_TOKEN?.trim() ?? "";
  const dryRun = input.dryRun ?? false;
  if (!dryRun && !botToken) {
    throw new Error("BOT_TOKEN \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D \u0432 \u0441\u0435\u0440\u0432\u0435\u0440\u043D\u043E\u043C \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u0438, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0440\u0435\u0430\u043B\u044C\u043D\u0443\u044E Telegram-\u0440\u0430\u0441\u0441\u044B\u043B\u043A\u0443 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.");
  }
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      if (dryRun) {
        return {
          chatId: recipient.chatId,
          label: recipient.label,
          source: recipient.source,
          ok: true,
          simulated: true,
          error: null,
          messageId: null
        };
      }
      try {
        const response = await sendTelegramMessage({
          botToken,
          chatId: recipient.chatId,
          text: input.message
        });
        return {
          chatId: recipient.chatId,
          label: recipient.label,
          source: recipient.source,
          ok: true,
          simulated: false,
          error: null,
          messageId: response.messageId
        };
      } catch (error) {
        return {
          chatId: recipient.chatId,
          label: recipient.label,
          source: recipient.source,
          ok: false,
          simulated: false,
          error: error instanceof Error ? error.message : "Unknown Telegram send error",
          messageId: null
        };
      }
    })
  );
  const deliveredCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - deliveredCount;
  const status = failedCount === 0 ? "completed" : deliveredCount === 0 ? "failed" : "partial";
  const saved = saveRuntimeBroadcast2({
    publicId: createPublicId("broadcast"),
    title: input.title,
    message: input.message,
    audience: input.audience,
    parseMode: input.parseMode ?? "plain",
    status,
    dryRun,
    requestedByUserId: actor.userId,
    requestedRecipients: recipients.length,
    deliveredCount,
    failedCount,
    recipientsJson: recipients,
    resultsJson: results,
    createdAt: requestedAt,
    completedAt: /* @__PURE__ */ new Date()
  });
  await persistAuditTrailEntry2({
    actorUserId: actor.userId,
    actorType: actor.userId ? "user" : "system",
    action: dryRun ? "broadcast.dry_run" : "broadcast.sent",
    resourceType: "broadcast",
    resourceId: saved.publicId,
    status: failedCount > 0 ? "failure" : "success",
    ipAddress: null,
    detailsJson: {
      audience: input.audience,
      requestedRecipients: recipients.length,
      deliveredCount,
      failedCount,
      dryRun,
      title: input.title
    },
    createdAt: requestedAt
  });
  return {
    ...saved,
    results
  };
}

// server/routers.ts
init_db();

// server/workerEngine/browserPool.ts
init_env();
import { chromium } from "playwright";

// server/workerEngine/humanBehavior.ts
async function humanDelay(minMs = 300, maxMs = 1200) {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
async function typingDelay(char) {
  let base;
  if (/\s/.test(char)) {
    base = 80 + Math.random() * 120;
  } else if (/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(char)) {
    base = 100 + Math.random() * 150;
  } else {
    base = 50 + Math.random() * 130;
  }
  if (Math.random() < 0.07) {
    base += 300 + Math.random() * 500;
  }
  await new Promise((resolve) => setTimeout(resolve, base));
}
async function humanType(page, selector, text2, { clearFirst = true } = {}) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  await el.click();
  await humanDelay(200, 500);
  if (clearFirst) {
    await el.evaluate((node) => {
      node.select?.() ?? node.setSelectionRange?.(0, node.value.length);
    });
    await el.press("Control+A");
    await page.keyboard.press("Backspace");
    await humanDelay(50, 150);
  }
  for (const char of text2) {
    await page.keyboard.type(char, { delay: 0 });
    await typingDelay(char);
  }
  await humanDelay(100, 400);
}
function bezierPoints(x1, y1, x2, y2, steps = 20) {
  const cx1 = x1 + (Math.random() - 0.5) * 200;
  const cy1 = y1 + (Math.random() - 0.5) * 100;
  const cx2 = x2 + (Math.random() - 0.5) * 200;
  const cy2 = y2 + (Math.random() - 0.5) * 100;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t2 = i / steps;
    const mt = 1 - t2;
    const bx = mt ** 3 * x1 + 3 * mt ** 2 * t2 * cx1 + 3 * mt * t2 ** 2 * cx2 + t2 ** 3 * x2;
    const by = mt ** 3 * y1 + 3 * mt ** 2 * t2 * cy1 + 3 * mt * t2 ** 2 * cy2 + t2 ** 3 * y2;
    points.push({ x: bx + (Math.random() - 0.5) * 2, y: by + (Math.random() - 0.5) * 2 });
  }
  return points;
}
async function bezierMouseMove(page, x1, y1, x2, y2, steps = 20) {
  await page.mouse.move(x1, y1);
  const points = bezierPoints(x1, y1, x2, y2, steps);
  for (const p of points) {
    await page.mouse.move(p.x, p.y);
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 20));
  }
}
async function humanClick(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  const box = await el.boundingBox();
  if (!box) {
    await el.click();
    return;
  }
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  const startX = targetX + (Math.random() - 0.5) * 400;
  const startY = targetY + (Math.random() - 0.5) * 300;
  await page.mouse.move(startX, startY);
  await humanDelay(50, 150);
  await bezierMouseMove(page, startX, startY, targetX, targetY, 15);
  await page.mouse.click(targetX, targetY);
}
async function warmUpPage(page) {
  await humanDelay(800, 2e3);
  for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) {
    const x = 100 + Math.random() * 600;
    const y = 100 + Math.random() * 400;
    await page.mouse.move(x, y);
    await humanDelay(100, 300);
  }
  await page.evaluate(() => window.scrollBy(0, 50 + Math.random() * 100));
  await humanDelay(200, 600);
  await page.evaluate(() => window.scrollBy(0, -(30 + Math.random() * 70)));
  await humanDelay(500, 1500);
}
function buildThreatMetrixNoiseScript() {
  return `
(function() {
  // --- Canvas noise ---
  const _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const idx = Math.floor(Math.random() * 3);
        data[idx] = data[idx] ^ (Math.floor(Math.random() * 3) > 0 ? 0 : 1);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return _origToDataURL.apply(this, arguments);
  };

  // --- WebGL readPixels noise ---
  const _origReadPixels = WebGLRenderingContext.prototype.readPixels;
  WebGLRenderingContext.prototype.readPixels = function(...args) {
    const result = _origReadPixels.apply(this, args);
    if (Math.random() < 0.05) {
      // Rare 1-bit noise
      const buf = args[args.length - 1];
      if (buf && buf.constructor === Uint8Array) {
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
          if (Math.random() < 0.001) view[i] ^= 1;
        }
      }
    }
    return result;
  };

  // --- Battery API spoof ---
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      Object.defineProperty(b, 'charging', { value: true });
      Object.defineProperty(b, 'chargingTime', { value: Infinity });
      Object.defineProperty(b, 'dischargingTime', { value: Infinity });
      Object.defineProperty(b, 'level', { value: 0.85 + Math.random() * 0.1 });
    });
  }

  // --- Permissions API spoof ---
  if (window.Permissions) {
    const _origQuery = window.Permissions.prototype.query;
    window.Permissions.prototype.query = function(opts) {
      return _origQuery.call(this, opts).then(result => {
        const DENY = ['notifications', 'push', 'midi', 'camera', 'microphone'];
        if (DENY.includes(opts.name)) {
          Object.defineProperty(result, 'state', { value: 'prompt' });
        }
        return result;
      });
    };
  }

  // --- Navigator WebGL spoof ---
  const _getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'NVIDIA Corporation';
    if (param === 37446) {
      const renderers = [
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
      ];
      return renderers[Math.floor(Math.random() * renderers.length)];
    }
    return _origGetParameter.call(this, param);
  };

  // --- AudioContext noise ---
  if (window.AudioContext || window.webkitAudioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const _origGetChannelData = AudioContext.prototype.prototype?.constructor?.prototype?.getChannelData;
    // Hook into analyser via scriptProcessor (deprecated but still works)
  }

  // --- navigator.platform spoof ---
  Object.defineProperty(navigator, 'platform', {
    value: ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
    writable: true,
  });

  // --- Hardware concurrency spoof ---
  const hcValues = [2, 4, 4, 4, 6, 8, 8, 12, 16];
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    value: hcValues[Math.floor(Math.random() * hcValues.length)],
    writable: true,
  });

  // --- Device memory spoof ---
  const dmValues = [2, 4, 4, 8, 8, 16];
  Object.defineProperty(navigator, 'deviceMemory', {
    value: dmValues[Math.floor(Math.random() * dmValues.length)],
    writable: true,
  });

  // --- Remove automation flags ---
  window.chrome = { runtime: {} };
  delete window.webdriver;
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
})();
  `.trim();
}
async function injectThreatMetrixNoisePost(page) {
  await page.evaluate(buildThreatMetrixNoiseScript());
}

// server/workerEngine/browserPool.ts
var BrowserPool = class {
  _browsers = [];
  _maxSize;
  _headless;
  _timeoutMs;
  _evomiHost;
  _evomiPort;
  _evomiUsername;
  _evomiPassword;
  constructor(config = {}) {
    this._maxSize = config.maxSize ?? 3;
    this._headless = config.headless ?? true;
    this._timeoutMs = config.timeoutMs ?? 6e4;
    this._evomiHost = ENV.evomiUsername ? "core-residential.evomi.com" : "";
    this._evomiPort = 1e3;
    this._evomiUsername = ENV.evomiUsername ?? "";
    this._evomiPassword = ENV.evomiPassword ?? "";
  }
  // ---------------------------------------------------------------------------
  // Acquire / Release
  // ---------------------------------------------------------------------------
  /**
   * Acquire a browser from the pool.
   * Creates a new browser if pool is not full, or returns a cached one.
   */
  async acquire(fingerprint, proxyUrl, proxyCountry) {
    this._cleanup();
    const cached = this._browsers.find((b) => !b.released);
    if (cached) {
      cached.fingerprint = fingerprint;
      return cached;
    }
    if (this._browsers.length >= this._maxSize) {
      const oldest = this._browsers[0];
      await this._closeBrowser(oldest);
    }
    const finalProxyUrl = proxyUrl ?? await this._buildProxyUrl(proxyCountry);
    const acquired = await this._launchBrowser(fingerprint, finalProxyUrl);
    this._browsers.push(acquired);
    return acquired;
  }
  /**
   * Release a browser back to the pool (marks as available for reuse).
   * Does NOT close the browser — it stays in the pool.
   */
  release(acquired) {
    acquired.released = true;
  }
  /**
   * Release a browser AND close it (removes from pool completely).
   */
  async forceClose(acquired) {
    const idx = this._browsers.indexOf(acquired);
    if (idx !== -1) this._browsers.splice(idx, 1);
    await this._closeBrowser(acquired);
  }
  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------
  get activeCount() {
    return this._browsers.filter((b) => !b.released).length;
  }
  get totalCount() {
    return this._browsers.length;
  }
  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  async _buildProxyUrl(country) {
    if (!this._evomiUsername || !this._evomiPassword) {
      return null;
    }
    const countrySuffix = country ? `_country-${country}` : "";
    return `http://${this._evomiUsername}:${this._evomiPassword}${countrySuffix}@${this._evomiHost}:${this._evomiPort}`;
  }
  async _launchBrowser(fingerprint, proxyUrl) {
    const args = [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process"
    ];
    const launchOptions = {
      headless: this._headless,
      args,
      timeout: this._timeoutMs
    };
    if (proxyUrl) {
      try {
        const url = new URL(proxyUrl);
        const proxyHost = url.hostname;
        const proxyPort = url.port || "80";
        launchOptions.args.push(`--proxy-server=${proxyHost}:${proxyPort}`);
        launchOptions.args.push(`--proxy-auth=${url.username}:${url.password}`);
      } catch {
        if (proxyUrl.includes("@")) {
          const afterAt = proxyUrl.split("@")[1] ?? "";
          launchOptions.args.push(`--proxy-server=${afterAt}`);
        }
      }
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent: fingerprint.userAgent,
      viewport: {
        width: fingerprint.screenWidth,
        height: fingerprint.screenHeight
      },
      locale: fingerprint.languages[0] ?? "en-US",
      timezoneId: fingerprint.timezone,
      extraHTTPHeaders: {
        "Accept-Language": fingerprint.languages.join(", "),
        "DNT": fingerprint.doNotTrack ?? "1"
      }
    });
    await context.addInitScript({ content: buildThreatMetrixNoiseScript() });
    const page = await context.newPage();
    return {
      browser,
      context,
      page,
      proxyUrl,
      fingerprint,
      released: false
    };
  }
  _cleanup() {
    for (let i = this._browsers.length - 1; i >= 0; i--) {
      if (this._browsers[i].released) {
      }
    }
  }
  async _closeBrowser(acquired) {
    try {
      await acquired.context.close();
    } catch {
    }
    try {
      await acquired.browser.close();
    } catch {
    }
  }
  /**
   * Shutdown the entire pool.
   */
  async shutdown() {
    for (const b of [...this._browsers]) {
      await this._closeBrowser(b);
    }
    this._browsers.length = 0;
  }
};
var _globalPool = null;
function getBrowserPool(config) {
  if (!_globalPool || config) {
    if (_globalPool) {
      _globalPool.shutdown().catch(() => {
      });
    }
    _globalPool = new BrowserPool(config);
  }
  return _globalPool;
}

// server/workerEngine/fingerprintRotator.ts
var SCREEN_RESOLUTIONS = [
  [1366, 768],
  [1920, 1080],
  [1440, 900],
  [1536, 864],
  [1280, 800],
  [1600, 900],
  [1280, 1024],
  [1024, 768],
  [1680, 1050],
  [1920, 1200],
  [2560, 1440],
  [1360, 768]
];
var TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Boise",
  "America/Anchorage",
  "Pacific/Honolulu"
];
var LANGUAGES = [
  ["en-US", "en"],
  ["en-US", "en", "es"],
  ["en-US", "en-GB", "en"],
  ["en-US"]
];
var PLATFORMS = ["Win32", "Win32", "Win32", "MacIntel", "Linux x86_64"];
var CPU_CORES = [2, 4, 4, 4, 6, 8, 8, 12, 16];
var DEVICE_MEMORY = [2, 4, 4, 8, 8, 16];
var WEBGL_VENDORS = [
  [
    "Google Inc. (NVIDIA)",
    "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)"
  ],
  [
    "Google Inc. (Intel)",
    "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  ],
  [
    "Google Inc. (AMD)",
    "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  ],
  [
    "Google Inc. (NVIDIA)",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  ],
  ["Intel Inc.", "Intel Iris OpenGL Engine"],
  ["Apple Inc.", "Apple GPU"]
];
var FF_VERSIONS = [
  "115.0",
  "116.0",
  "117.0",
  "118.0",
  "119.0",
  "120.0",
  "121.0",
  "122.0",
  "123.0"
];
var WIN_VERSIONS = [
  "Windows NT 10.0; Win64; x64",
  "Windows NT 10.0; WOW64",
  "Windows NT 6.1; Win64; x64"
];
var MAC_VERSIONS = [
  "Macintosh; Intel Mac OS X 10.15",
  "Macintosh; Intel Mac OS X 11.0",
  "Macintosh; Intel Mac OS X 12.0",
  "Macintosh; Intel Mac OS X 13.0"
];
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function buildFirefoxUserAgent(platform, ffVersion) {
  let osStr;
  if (platform === "MacIntel") {
    osStr = pick(MAC_VERSIONS);
  } else if (platform === "Linux x86_64") {
    osStr = "X11; Linux x86_64";
  } else {
    osStr = pick(WIN_VERSIONS);
  }
  return `Mozilla/5.0 (${osStr}; rv:${ffVersion}) Gecko/20100101 Firefox/${ffVersion}`;
}
var FingerprintRotator = class {
  /**
   * Generate a fresh, randomized FingerprintProfile.
   * Call `.generate()` to get a new profile for each browser request.
   */
  generate() {
    const screen = pick(SCREEN_RESOLUTIONS);
    const tz = pick(TIMEZONES);
    const langs = pick(LANGUAGES);
    const platform = pick(PLATFORMS);
    const cores = pick(CPU_CORES);
    const mem = pick(DEVICE_MEMORY);
    const webgl = pick(WEBGL_VENDORS);
    const ffVer = pick(FF_VERSIONS);
    const userAgent = buildFirefoxUserAgent(platform, ffVer);
    return {
      userAgent,
      screenWidth: screen[0],
      screenHeight: screen[1],
      timezone: tz,
      languages: langs,
      platform,
      hardwareConcurrency: cores,
      deviceMemory: mem,
      webglVendor: webgl[0],
      webglRenderer: webgl[1],
      canvasNoiseSeed: randInt(1, 999999),
      audioNoiseSeed: randInt(1, 999999),
      // Mostly no DNT (2/3 chance of null)
      doNotTrack: Math.random() < 0.33 ? "1" : null
    };
  }
  /**
   * Convert a FingerprintProfile to Playwright BrowserContext options.
   * Pass these to `browser.newContext(...)`.
   */
  toContextOptions(profile) {
    return {
      userAgent: profile.userAgent,
      viewport: {
        width: profile.screenWidth,
        height: profile.screenHeight
      },
      locale: profile.languages[0] ?? "en-US",
      timezoneId: profile.timezone,
      extraHTTPHeaders: {
        "Accept-Language": [...profile.languages, "q=0.9"].join(",").replace("en-US,q=0.9", "en-US,en;q=0.9"),
        "DNT": profile.doNotTrack ?? "1"
      }
      // deviceScaleFactor and isMobile left unset — default desktop
    };
  }
  /**
   * Return anti-detection launch arguments to pass to browser.newPage().
   * These are applied AFTER context creation and are passed as launch args
   * or via page.addInitScript.
   */
  getAntiDetectLaunchArgs() {
    return [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process"
    ];
  }
  /**
   * Build an object with all WebGL spoofing parameters.
   * Use with page.addInitScript to inject into the page.
   */
  buildWebGlSpoof(profile) {
    return {
      vendor: profile.webglVendor,
      renderer: profile.webglRenderer
    };
  }
};
var defaultFingerprintRotator = new FingerprintRotator();

// server/workerEngine/ssnFlowManager.ts
var SSN_DIGIT_RE = /^\d{3}-\d{2}-\d{4}$|^\d{9}$/;
function ssnAreaDigits(raw) {
  const digits = raw.replace(/\D/g, "");
  const area = parseInt(digits.slice(0, 3), 10);
  return area;
}
var INVALID_AREAS = /* @__PURE__ */ new Set(["0".padStart(3, "0"), "666", "900", "901", "902", "903", "904", "905", "906", "907", "908", "909"]);
var SSNFlowManager = class _SSNFlowManager {
  /**
   * Map from jobId → pending Promise resolvers.
   * The inner record holds the resolve/reject functions plus metadata.
   */
  _pending = /* @__PURE__ */ new Map();
  /**
   * Expire requests after this many milliseconds.
   * Default: 10 minutes.
   */
  _ttlMs;
  _expiryTimer = null;
  constructor(ttlMs = 10 * 60 * 1e3) {
    this._ttlMs = ttlMs;
  }
  /** Number of currently pending SSN requests. */
  get pendingCount() {
    return this._pending.size;
  }
  /** True if there is a pending request for the given jobId. */
  hasPending(jobId) {
    return this._pending.has(jobId);
  }
  /**
   * Create a pending SSN request for a job.
   * Returns a Promise that resolves when the operator provides the SSN
   * (via `provideSsn`) or rejects if the request times out or is canceled.
   *
   * @param jobId - The job's public ID
   * @param chatId - Telegram chat ID where the request is sent (can be null for dashboard-only flow)
   */
  createRequest(jobId, chatId = null) {
    if (this._pending.has(jobId)) {
      return Promise.reject(new Error(`SSN request already pending for job ${jobId}`));
    }
    const record = {
      jobId,
      chatId,
      createdAt: /* @__PURE__ */ new Date(),
      status: "pending"
    };
    return new Promise((resolve, reject) => {
      this._pending.set(jobId, { resolve, reject, record });
      const timer = setTimeout(() => {
        this._pending.delete(jobId);
        reject(new Error(`SSN request expired for job ${jobId} after ${this._ttlMs}ms`));
      }, this._ttlMs);
      void timer;
    });
  }
  /**
   * Provide an SSN for a pending job. Validates the format before resolving.
   *
   * @returns An SsnValidateResult indicating whether validation succeeded.
   */
  provideSsn(jobId, raw) {
    const entry = this._pending.get(jobId);
    if (!entry) {
      return { valid: false, reason: `No pending SSN request for job ${jobId}` };
    }
    const validation = _SSNFlowManager.validateSsn(raw);
    if (!validation.valid) {
      return validation;
    }
    const { resolve } = entry;
    this._pending.delete(jobId);
    entry.record.status = "resolved";
    resolve(validation.normalized);
    return validation;
  }
  /**
   * Cancel a pending SSN request without providing the SSN.
   */
  cancelRequest(jobId) {
    const entry = this._pending.get(jobId);
    if (!entry) return;
    const { reject } = entry;
    this._pending.delete(jobId);
    entry.record.status = "canceled";
    reject(new Error(`SSN request canceled for job ${jobId}`));
  }
  /**
   * Validate and normalize an SSN string.
   *
   * Accepts two formats:
   *   - "XXX-XX-XXXX" (dashed)
   *   - "XXXXXXXXX"   (raw 9-digit)
   *
   * Returns a normalized result or `{ valid: false, reason }`.
   */
  static validateSsn(raw) {
    const cleaned = (raw ?? "").trim();
    if (!cleaned) {
      return { valid: false, reason: "SSN cannot be empty" };
    }
    if (!SSN_DIGIT_RE.test(cleaned)) {
      return { valid: false, reason: "SSN must be 9 digits, optionally formatted as XXX-XX-XXXX" };
    }
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length !== 9) {
      return { valid: false, reason: "SSN must contain exactly 9 digits" };
    }
    const area = ssnAreaDigits(digits);
    if (INVALID_AREAS.has(String(area).padStart(3, "0"))) {
      return { valid: false, reason: "Invalid SSN area number" };
    }
    const group = parseInt(digits.slice(3, 5), 10);
    if (group === 0) {
      return { valid: false, reason: "Invalid SSN group number (first two digits cannot be 00)" };
    }
    const serial = parseInt(digits.slice(5, 9), 10);
    if (serial === 0) {
      return { valid: false, reason: "Invalid SSN serial number (last four digits cannot be 0000)" };
    }
    const normalized = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
    return { valid: true, normalized };
  }
  /**
   * Validate a raw SSN string (instance method convenience wrapper).
   */
  validateSsn(raw) {
    return _SSNFlowManager.validateSsn(raw);
  }
  /** Iterator over all pending request records (read-only). */
  pendingRequests() {
    return Array.from(this._pending.values(), (entry) => entry.record);
  }
};

// server/workerEngine/scoreExtractor.ts
function isValidScore(value) {
  return Number.isInteger(value) && value >= 300 && value <= 850;
}

// server/workerEngine/csWorkerEngine.ts
init_oneCsScoring();
init_env();
var UC_FUNNEL_URL = "https://www.universal-credit.com/funnel/personal-information-1/DEBT_CONSOLIDATION/5000?step=contact";
var UC_DOCUMENTS_URL = "https://www.universal-credit.com/portal/profile/documents";
var STEP_TIMEOUT_MS = 6e4;
var FORM_TIMEOUT_MS = 12e4;
var ACCOUNT_PASSWORD = "Secure#Pass2025!";
function randomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = Array.from(
    { length: 10 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me"];
  return `${prefix}@${domains[Math.floor(Math.random() * domains.length)]}`;
}
async function extractScoreFromPdfBytes(pdfBytes) {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdfDoc = await loadingTask.promise;
    const lines = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str ?? "").join(" ");
      lines.push(pageText);
    }
    const fullText = lines.join("\n");
    const scorePatterns = [
      { re: /(?:credit\s+score|fico\s+score|score\s+value)[^\d]*(\d{3})/i, priority: 1 },
      { re: /(?:your\s+score\s+is)[^\d]*(\d{3})/i, priority: 2 },
      { re: /(?:score)[^\d]{0,20}(\d{3})/i, priority: 3 },
      { re: /\b([5-8]\d{2})\b/, priority: 4 }
    ];
    for (const { re } of scorePatterns) {
      const allMatches = fullText.matchAll(re);
      const matchArr = Array.from(allMatches);
      if (matchArr.length > 0) {
        const last = matchArr[matchArr.length - 1];
        const raw = parseInt(last[1] ?? "0", 10);
        if (isValidScore(raw)) return raw;
      }
    }
    return null;
  } catch {
    try {
      const decoder = new TextDecoder("latin-1");
      const raw = decoder.decode(pdfBytes);
      const match = raw.match(/(?:score|credit)[^\d]{0,30}(\d{3})/i);
      if (match) {
        const score = parseInt(match[1], 10);
        if (isValidScore(score)) return score;
      }
    } catch {
    }
    return null;
  }
}
var CreditScoreWorker = class {
  _workerId;
  _fingerprintRotator;
  _ssnFlow;
  _browserPool;
  _safeTestMode;
  _proxyCountry;
  _running = false;
  _activeBrowser = false;
  constructor(opts) {
    this._workerId = opts.workerId;
    this._fingerprintRotator = new FingerprintRotator();
    this._ssnFlow = new SSNFlowManager();
    this._safeTestMode = opts.safeTestMode ?? !ENV.evomiUsername;
    this._proxyCountry = opts.proxyCountry;
    this._browserPool = opts.browserPool ?? getBrowserPool();
  }
  get workerId() {
    return this._workerId;
  }
  get isRunning() {
    return this._running;
  }
  /**
   * Process a single job (entry point from WorkerPool).
   */
  async processJob(job) {
    const startTime = Date.now();
    let proxyLeaseId;
    let proxyIp = null;
    try {
      this._running = true;
      if (this._safeTestMode) {
        return this._processSafeMode(job, startTime);
      }
      const proxyOpts = {};
      if (this._proxyCountry) proxyOpts.country = this._proxyCountry;
      const lease = await acquireProxy(proxyOpts);
      if (lease) {
        proxyLeaseId = lease.leaseId;
        proxyIp = lease.assignedIp;
      }
      try {
        const result = await this._processBrowserMode(job, lease ?? null);
        return { ...result, proxyLeaseId, proxyIp, durationMs: Date.now() - startTime };
      } finally {
        if (lease) {
          await releaseProxy({ leaseId: lease.leaseId, success: true });
        }
      }
    } catch (err) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: String(err),
        workerId: this._workerId,
        proxyIp,
        durationMs: Date.now() - startTime,
        needsSsn: false,
        source: "system",
        proxyLeaseId
      };
    } finally {
      this._running = false;
    }
  }
  // ---------------------------------------------------------------------------
  // Safe test mode
  // ---------------------------------------------------------------------------
  _processSafeMode(job, startTime) {
    const creditScore = 450 + this._simpleHash(job.firstName + job.lastName + job.dob) % 400;
    const oneCsResult = buildOneCsResult({
      creditScore,
      completenessScore: 0.75,
      adverseReasons: [],
      source: "testbench"
    });
    return {
      jobId: job.jobId,
      status: "succeeded",
      creditScore,
      productScore: oneCsResult.productScore,
      dataQualityScore: oneCsResult.dataQualityScore,
      status_: oneCsResult.status,
      error: null,
      workerId: this._workerId,
      proxyIp: null,
      durationMs: Date.now() - startTime,
      needsSsn: false,
      source: "testbench",
      explanations: oneCsResult.explanations
    };
  }
  // ---------------------------------------------------------------------------
  // Browser mode — 3-step form flow (adapted from cs_worker.py)
  // ---------------------------------------------------------------------------
  async _processBrowserMode(job, lease) {
    if (!ENV.evomiUsername) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Evomi credentials not configured",
        workerId: this._workerId,
        proxyIp: null,
        durationMs: null,
        needsSsn: false,
        source: "system"
      };
    }
    const fingerprint = this._fingerprintRotator.generate();
    const proxyUrl = lease ? this._buildProxyUrl(lease) : null;
    const acquired = await this._browserPool.acquire(fingerprint, proxyUrl, this._proxyCountry);
    this._activeBrowser = true;
    try {
      await injectThreatMetrixNoisePost(acquired.page);
      await acquired.page.goto("about:blank");
      await warmUpPage(acquired.page);
      await acquired.page.goto(UC_FUNNEL_URL, {
        waitUntil: "domcontentloaded",
        timeout: FORM_TIMEOUT_MS
      });
      await warmUpPage(acquired.page);
      await acquired.page.addStyleTag({
        content: `
          [data-webby-wrap] { display: none !important; }
          #webby_extension { display: none !important; }
        `
      });
      await this._fillStep1(acquired.page, job);
      await this._clickContinue(acquired.page);
      await this._waitForStep(acquired.page, "income", STEP_TIMEOUT_MS);
      await this._fillStep2(acquired.page, job);
      await this._clickContinue(acquired.page);
      await this._waitForStep(acquired.page, "login", STEP_TIMEOUT_MS);
      const email = job.email ?? randomEmail();
      await this._fillStep3(acquired.page, email);
      await this._submitForm(acquired.page);
      const resultUrl = await this._waitForResult(acquired.page, FORM_TIMEOUT_MS);
      if (resultUrl.includes("adverse-page") || resultUrl.includes("offer-page")) {
        return await this._extractScore(acquired.page, job, acquired.proxyUrl);
      }
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: `Form did not advance past login. URL: ${resultUrl}`,
        workerId: this._workerId,
        proxyIp: acquired.proxyUrl,
        durationMs: null,
        needsSsn: false,
        source: "api"
      };
    } finally {
      this._activeBrowser = false;
      this._browserPool.release(acquired);
    }
  }
  // ---------------------------------------------------------------------------
  // Form filling — Step 1: Personal information
  // ---------------------------------------------------------------------------
  async _fillStep1(page, job) {
    const firstNameField = page.locator("[name='borrowerFirstName']").first();
    if (await firstNameField.isVisible()) {
      await humanType(page, "[name='borrowerFirstName']", job.firstName);
    }
    const lastNameField = page.locator("[name='borrowerLastName']").first();
    if (await lastNameField.isVisible()) {
      await humanType(page, "[name='borrowerLastName']", job.lastName);
    }
    await this._fillAddress(page, job);
    await this._fillDob(page, job.dob);
    if (job.phone) {
      await this._fillPhoneIfPresent(page, job.phone);
    }
  }
  async _fillAddress(page, job) {
    const addrSel = "[name='borrowerStreet'], #geosuggest__input--borrowerStreet, [id*='geosuggest'], [placeholder*='address' i]";
    const addrField = page.locator(addrSel).first();
    if (!await addrField.isVisible({ timeout: 5e3 }).catch(() => false)) {
      const inputs = await page.locator("input").all();
      for (const inp of inputs) {
        const hint = await inp.getAttribute("hint").catch(() => null) ?? "";
        const label = await inp.getAttribute("aria-label").catch(() => null) ?? "";
        const placeholder = (await inp.getAttribute("placeholder").catch(() => null) ?? "").toLowerCase();
        if (hint.toLowerCase().includes("street") || label.toLowerCase().includes("street") || placeholder.includes("street")) {
          await this._fillAddressField(page, inp, job);
          return;
        }
      }
      throw new Error("Address field not found");
    }
    await this._fillAddressField(page, addrField, job);
  }
  async _fillAddressField(page, field, job) {
    await field.click();
    await humanDelay(300, 600);
    await field.fill("");
    await new Promise((r) => setTimeout(r, 200));
    const searchText = `${job.street} ${job.zipCode}`;
    for (const char of searchText) {
      await field.type(char, { delay: 0 });
      await typingDelay(char);
    }
    await new Promise((r) => setTimeout(r, 2e3));
    const suggestions = page.locator(
      ".geosuggest__suggests li, [class*='suggest'] li, [class*='autocomplete'] li, [class*='dropdown'] li, [class*='menu'] li"
    );
    const count = await suggestions.count();
    let selected = false;
    for (let i = 0; i < count; i++) {
      const text2 = await suggestions.nth(i).textContent().catch(() => "") ?? "";
      if (text2.toUpperCase().includes(job.state.toUpperCase())) {
        await suggestions.nth(i).click();
        selected = true;
        break;
      }
    }
    if (!selected && count > 0) {
      await suggestions.first().click();
    }
    await humanDelay(500, 1e3);
    for (const [name, value] of [
      ["borrowerCity", job.city],
      ["borrowerState", job.state],
      ["borrowerZipCode", job.zipCode]
    ]) {
      const el = page.locator(`[name='${name}']`).first();
      if (await el.isVisible({ timeout: 2e3 }).catch(() => false)) {
        const current = await el.inputValue().catch(() => "");
        if (!current.trim()) {
          await humanType(page, `[name='${name}']`, value);
        }
      }
    }
  }
  async _fillDob(page, dob) {
    const dobField = page.locator("[name='borrowerDateOfBirth']").first();
    if (await dobField.isVisible({ timeout: 2e3 }).catch(() => false)) {
      await humanType(page, "[name='borrowerDateOfBirth']", dob);
      return;
    }
    const parts = dob.split("/");
    if (parts.length !== 3) return;
    const [mm, dd, yyyy] = parts;
    const labels = ["month", "day", "year"];
    const values = [mm, dd, yyyy];
    for (let i = 0; i < labels.length; i++) {
      const el = page.locator(
        `[aria-label*='${labels[i]}' i], [placeholder*='${labels[i]}' i], [hint*='${labels[i]}' i]`
      ).first();
      if (await el.isVisible({ timeout: 1e3 }).catch(() => false)) {
        await el.click();
        await humanDelay(100, 300);
        await el.fill(values[i]);
        await humanDelay(100, 200);
      }
    }
  }
  async _fillPhoneIfPresent(page, phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    const area = digits.slice(0, 3);
    const first3 = digits.slice(3, 6);
    const last4 = digits.slice(6, 10);
    for (const [hintText, value] of [
      ["area code", area],
      ["first 3", first3],
      ["last 4", last4]
    ]) {
      const el = page.locator(
        `[aria-label*='${hintText}' i], [placeholder*='${hintText}' i], [hint*='${hintText}' i]`
      ).first();
      if (await el.isVisible({ timeout: 1e3 }).catch(() => false)) {
        await el.click();
        await humanDelay(100, 250);
        await el.fill(value);
      }
    }
    const single = page.locator("[name='borrowerPhoneNumber'], [name='phone']").first();
    if (await single.isVisible({ timeout: 1e3 }).catch(() => false)) {
      await humanType(page, "[name='borrowerPhoneNumber']", digits.slice(0, 10));
    }
  }
  // ---------------------------------------------------------------------------
  // Form filling — Step 2: Income
  // ---------------------------------------------------------------------------
  async _fillStep2(page, job) {
    const incomeField = page.locator("[name='borrowerIncome']").first();
    if (await incomeField.isVisible({ timeout: 5e3 }).catch(() => false)) {
      await humanType(page, "[name='borrowerIncome']", job.annualIncome);
      return;
    }
    const inputs = page.locator("input[type='number'], input[inputmode='numeric']");
    if (await inputs.first().isVisible({ timeout: 2e3 }).catch(() => false)) {
      await inputs.first().fill(job.annualIncome);
    }
  }
  // ---------------------------------------------------------------------------
  // Form filling — Step 3: Create account
  // ---------------------------------------------------------------------------
  async _fillStep3(page, email) {
    const emailField = page.locator("[name='username'], [name='email'], [type='email']").first();
    if (await emailField.isVisible({ timeout: 5e3 }).catch(() => false)) {
      await humanType(page, "[name='username'], [name='email']", email);
    }
    await humanDelay(300, 700);
    const passwordField = page.locator("[name='password'], [type='password']").first();
    if (await passwordField.isVisible({ timeout: 2e3 }).catch(() => false)) {
      await humanType(page, "[name='password'], [type='password']", ACCOUNT_PASSWORD);
    }
    await humanDelay(400, 800);
    const checkbox = page.locator("[name='agreements'], [type='checkbox']").first();
    if (await checkbox.isVisible({ timeout: 2e3 }).catch(() => false)) {
      const checked = await checkbox.isChecked().catch(() => false);
      if (!checked) {
        await checkbox.click();
        await humanDelay(200, 500);
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------
  async _clickContinue(page) {
    const btn = page.locator(
      "button:has-text('Continue'), button[type='submit']:has-text('Continue'), input[type='submit'][value*='Continue' i]"
    ).first();
    if (await btn.isVisible({ timeout: 5e3 }).catch(() => false)) {
      await humanClick(page, "button:has-text('Continue')");
    } else {
      await page.keyboard.press("Enter");
    }
    await humanDelay(500, 1500);
  }
  async _submitForm(page) {
    const btn = page.locator(
      "button:has-text('Check Your Rate'), button[type='submit']:has-text('Check'), button[type='submit']"
    ).first();
    if (await btn.isVisible({ timeout: 5e3 }).catch(() => false)) {
      await humanClick(page, "button:has-text('Check Your Rate')");
    } else {
      await page.keyboard.press("Enter");
    }
    await new Promise((r) => setTimeout(r, 3e3));
    for (let i = 0; i < 60; i++) {
      const overlayVisible = await page.evaluate(() => {
        const el = document.getElementById("sec-overlay");
        return el && el.offsetParent !== null;
      }).catch(() => false);
      if (!overlayVisible) break;
      await new Promise((r) => setTimeout(r, 1e3));
    }
  }
  async _waitForStep(page, stepName, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes(`step=${stepName}`)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Step '${stepName}' did not appear within ${timeoutMs}ms. URL: ${page.url()}`);
  }
  async _waitForResult(page, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes("adverse-page") || url.includes("offer-page")) {
        return url;
      }
      await new Promise((r) => setTimeout(r, 1e3));
    }
    return page.url();
  }
  // ---------------------------------------------------------------------------
  // Score extraction from Adverse Action Notice PDF
  // ---------------------------------------------------------------------------
  async _extractScore(page, job, proxyIp) {
    await page.goto(UC_DOCUMENTS_URL, { waitUntil: "domcontentloaded", timeout: 3e4 });
    await new Promise((r) => setTimeout(r, 5e3));
    let adverseAppeared = false;
    for (let i = 0; i < 45; i++) {
      const hasAdverse = await page.evaluate(
        () => Array.from(document.querySelectorAll("*")).some(
          (el) => el.textContent?.toLowerCase().includes("adverse action")
        )
      ).catch(() => false);
      if (hasAdverse) {
        adverseAppeared = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1e3));
    }
    if (!adverseAppeared) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Adverse Action Notice not found in Documents portal",
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api"
      };
    }
    const pdfData = await this._downloadAdverseActionPdf(page);
    if (pdfData === null) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Could not download Adverse Action Notice PDF",
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api"
      };
    }
    const score = await extractScoreFromPdfBytes(pdfData);
    if (score !== null) {
      const oneCsResult = buildOneCsResult({
        creditScore: score,
        completenessScore: 0.85,
        adverseReasons: [],
        source: "api"
      });
      return {
        jobId: job.jobId,
        status: "succeeded",
        creditScore: score,
        productScore: oneCsResult.productScore,
        dataQualityScore: oneCsResult.dataQualityScore,
        status_: oneCsResult.status,
        error: null,
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api",
        explanations: oneCsResult.explanations,
        pdfPath: `adverse_action_${job.jobId}.pdf`
      };
    }
    return {
      jobId: job.jobId,
      status: "failed",
      creditScore: null,
      productScore: null,
      dataQualityScore: null,
      status_: null,
      error: "PDF downloaded but credit score not found in text",
      workerId: this._workerId,
      proxyIp,
      durationMs: null,
      needsSsn: false,
      source: "api",
      pdfPath: `adverse_action_${job.jobId}.pdf`
    };
  }
  async _downloadAdverseActionPdf(page) {
    let pdfBytes = null;
    const responsePromise = page.waitForResponse(
      (resp) => {
        const ct = resp.headers()["content-type"] ?? "";
        return ct.includes("pdf") || resp.url().endsWith(".pdf");
      },
      { timeout: 3e4 }
    ).catch(() => null);
    const dlBtn = page.locator("button, a, [class*='download'], svg").filter({
      hasText: /adverse action/i
    }).first();
    const btnVisible = await dlBtn.isVisible({ timeout: 5e3 }).catch(() => false);
    if (btnVisible) {
      await dlBtn.click();
      const resp = await responsePromise;
      if (resp) {
        const buffer = await resp.body();
        if (buffer && buffer.byteLength > 4 && new Uint8Array(buffer.slice(0, 4))[0] === 37) {
          pdfBytes = new Uint8Array(buffer);
        }
      }
    }
    if (!pdfBytes) {
      const dlEl = await page.evaluateHandle(`
        () => {
          const rows = Array.from(document.querySelectorAll('li, tr, [class*="row"], [class*="item"], [class*="document"]'));
          for (const row of rows) {
            if (row.textContent.toLowerCase().includes('adverse action')) {
              const btn = row.querySelector('a[href], button, [class*="download"], svg');
              if (btn) return btn;
            }
          }
          // Fallback: any link near "adverse action" text
          const allLinks = Array.from(document.querySelectorAll('a, button'));
          for (const link of allLinks) {
            const parent = link.closest('li, tr, div');
            if (parent && parent.textContent.toLowerCase().includes('adverse action')) {
              return link;
            }
          }
          return null;
        }
      `).catch(() => null);
      if (dlEl) {
        try {
          const el = dlEl.asElement();
          if (el) {
            await el.click();
            await new Promise((r) => setTimeout(r, 5e3));
            const resp = await responsePromise;
            if (resp) {
              const buffer = await resp.body();
              if (buffer && buffer.byteLength > 4 && new Uint8Array(buffer.slice(0, 4))[0] === 37) {
                pdfBytes = new Uint8Array(buffer);
              }
            }
          }
        } catch {
        }
      }
    }
    return pdfBytes;
  }
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _buildProxyUrl(lease) {
    if (lease.provider === "evomi") {
      const country = lease.country ? `_country-${lease.country}` : "";
      return `http://${lease.username}:${lease.password}${country}@${lease.host}:${lease.port}`;
    }
    return `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`;
  }
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
};
var WorkerPool = class {
  _workers = [];
  _jobQueue = [];
  _running = [];
  _numWorkers;
  _safeTestMode;
  _proxyCountry;
  _onEvent;
  _started = false;
  _browserPool;
  constructor(config = {}) {
    this._numWorkers = config.numWorkers ?? 2;
    this._safeTestMode = config.safeTestMode ?? !ENV.evomiUsername;
    this._proxyCountry = config.proxyCountry;
    this._onEvent = config.onEvent;
    this._browserPool = getBrowserPool({ headless: config.headless ?? true });
  }
  async start() {
    if (this._started) return;
    this._started = true;
    for (let i = 0; i < this._numWorkers; i++) {
      this._workers.push(
        new CreditScoreWorker({
          workerId: i,
          safeTestMode: this._safeTestMode,
          proxyCountry: this._proxyCountry,
          browserPool: this._browserPool
        })
      );
      this._running.push(false);
      this._dispatch({ type: "worker.started", workerId: i });
    }
    for (let i = 0; i < this._numWorkers; i++) {
      void this._workerLoop(i);
    }
  }
  async stop() {
    this._started = false;
    for (let i = 0; i < this._running.length; i++) {
      this._running[i] = false;
    }
    await this._browserPool.shutdown();
  }
  /**
   * Submit a job and wait for result.
   */
  submit(job) {
    return new Promise((resolve, reject) => {
      this._jobQueue.push({ job, resolve, reject });
      this._dispatch({ type: "job.queued", jobId: job.jobId, queueSize: this._jobQueue.length });
    });
  }
  get queueSize() {
    return this._jobQueue.length;
  }
  get activeWorkers() {
    return this._running.filter(Boolean).length;
  }
  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  async _workerLoop(workerId) {
    this._running[workerId] = true;
    while (this._started && this._running[workerId]) {
      const entry = this._jobQueue.shift();
      if (!entry) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const { job, resolve, reject } = entry;
      try {
        this._dispatch({ type: "job.started", jobId: job.jobId, workerId });
        const result = await this._workers[workerId].processJob(job);
        if (result.status === "succeeded") {
          this._dispatch({
            type: "job.completed",
            jobId: job.jobId,
            creditScore: result.creditScore,
            durationMs: result.durationMs
          });
        } else {
          this._dispatch({
            type: "job.failed",
            jobId: job.jobId,
            error: result.error ?? "unknown"
          });
        }
        resolve(result);
      } catch (err) {
        this._dispatch({ type: "job.failed", jobId: job.jobId, error: String(err) });
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
  _dispatch(event) {
    try {
      this._onEvent?.(event);
    } catch (err) {
      console.error("[WorkerPool] Event handler error:", err);
    }
  }
};

// server/workerEngine/index.ts
init_oneCsScoring();
var WorkerEngineImpl = class {
  _pool;
  _events;
  _pollIntervalMs;
  _heartbeatIntervalMs;
  _heartbeatTimeoutMs;
  _running = false;
  _pollTimer = null;
  _heartbeatTimer = null;
  constructor(options = {}) {
    this._pollIntervalMs = options.pollIntervalMs ?? 5e3;
    this._heartbeatIntervalMs = options.heartbeatIntervalMs ?? 3e4;
    this._heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 9e4;
    this._pool = new WorkerPool({
      numWorkers: options.maxWorkers ?? 4,
      maxConcurrency: options.maxConcurrency ?? 2,
      safeTestMode: true
    });
    this._events = options;
  }
  get isRunning() {
    return this._running;
  }
  get pool() {
    return this._pool;
  }
  get workerPool() {
    return this._pool;
  }
  get events() {
    return this._events;
  }
  async submitJob(req) {
    const score = typeof req.payload.creditScore === "number" ? req.payload.creditScore : null;
    const safeTest = req.safeTestMode;
    const result = buildOneCsResult({
      creditScore: score,
      completenessScore: 0.8,
      adverseReasons: [],
      source: "testbench"
    });
    const simulateError = req.payload.simulateError;
    const simulateTimeout = req.payload.simulateTimeout;
    if (simulateTimeout) {
      return {
        jobPublicId: req.jobPublicId,
        status: "timeout",
        creditScore: null,
        productScore: 1,
        dataQualityScore: 1,
        ssnProvided: Boolean(req.payload.ssn ?? req.payload.socialSecurityNumber),
        extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
        executionMs: 9e4,
        proxyUsed: null,
        errorCode: "BROWSER_TIMEOUT",
        errorMessage: "Browser automation exceeded timeout threshold"
      };
    }
    if (simulateError) {
      return {
        jobPublicId: req.jobPublicId,
        status: "failed",
        creditScore: null,
        productScore: 1,
        dataQualityScore: 1,
        ssnProvided: Boolean(req.payload.ssn ?? req.payload.socialSecurityNumber),
        extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
        executionMs: 500,
        proxyUsed: null,
        errorCode: "EXECUTION_ERROR",
        errorMessage: String(req.payload.errorDetail ?? "Browser connection failed")
      };
    }
    return {
      jobPublicId: req.jobPublicId,
      status: "succeeded",
      creditScore: safeTest ? 720 : score ?? null,
      productScore: result.productScore,
      dataQualityScore: result.dataQualityScore,
      ssnProvided: Boolean(req.payload.ssn ?? req.payload.socialSecurityNumber),
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      executionMs: safeTest ? 50 : 5e3,
      proxyUsed: req.proxyConfig?.providerHint ?? (safeTest ? "mock://safe-test" : null)
    };
  }
  registerWorker(config) {
    const instance = {
      id: `worker_${config.id}_${Date.now().toString(36)}`,
      name: config.name,
      config,
      status: "idle",
      currentJob: null,
      startedAt: /* @__PURE__ */ new Date(),
      lastHeartbeatAt: /* @__PURE__ */ new Date(),
      completedJobs: 0,
      failedJobs: 0
    };
    this._events.onWorkerRegistered?.(instance);
    return instance;
  }
  deregisterWorker(workerId) {
    this._events.onWorkerDeregistered?.(workerId);
  }
  _monitorHeartbeats() {
  }
  start() {
    if (this._running) return;
    this._running = true;
    console.info("[WorkerEngine] Starting worker engine...");
    this._pollTimer = setInterval(() => {
    }, this._pollIntervalMs);
    this._heartbeatTimer = setInterval(() => {
      this._monitorHeartbeats();
    }, this._heartbeatIntervalMs);
    console.info(`[WorkerEngine] Engine started (poll=${this._pollIntervalMs}ms)`);
  }
  async stop() {
    if (!this._running) return;
    this._running = false;
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._pool.stop();
    console.info("[WorkerEngine] Engine stopped");
  }
};
var _globalEngine = null;
function getGlobalEngine() {
  if (!_globalEngine) _globalEngine = new WorkerEngineImpl();
  return _globalEngine;
}

// server/routers.ts
var workerConfigSchema = z5.object({
  id: z5.number().int().positive(),
  name: z5.string().min(1).max(128),
  concurrency: z5.number().int().min(1).max(64).default(1),
  safeTestMode: z5.boolean().default(false),
  maxRetries: z5.number().int().min(1).max(10).default(3),
  proxyRotateAfterN: z5.number().int().min(1).max(100).default(20),
  ssnTimeoutMs: z5.number().int().min(1e3).max(3e5).default(9e4),
  browserTimeoutMs: z5.number().int().min(5e3).max(6e5).default(6e4)
});
var workerSubmitJobSchema = z5.object({
  jobPublicId: z5.string().min(1).max(64),
  payload: z5.record(z5.string(), z5.unknown()),
  proxyConfig: z5.object({
    country: z5.string().max(8).optional(),
    providerHint: z5.string().max(64).optional(),
    sessionMode: z5.enum(["rotating", "sticky", "hard_sticky"]).default("sticky")
  }).optional(),
  priority: z5.number().int().min(1).max(1e3).default(100),
  queueName: z5.string().max(64).default("default"),
  safeTestMode: z5.boolean().default(false),
  maxRetries: z5.number().int().min(1).max(10).default(3)
});
var jobsRouter = router({
  list: adminProcedure.input(jobFilterSchema.optional()).query(async () => {
    return getJobsModule();
  }),
  get: protectedProcedure.input(z5.object({ publicId: z5.string().min(3).max(64) })).query(async ({ input }) => {
    return getJobDetails(input.publicId);
  }),
  createSafeSingle: adminProcedure.input(createJobSchema).mutation(async ({ ctx, input }) => {
    return createSingleJob(
      {
        ...input,
        safeTestMode: true
      },
      { userId: ctx.user.id, source: "dashboard" }
    );
  }),
  createSafeBulk: adminProcedure.input(createBulkJobSchema).mutation(async ({ ctx, input }) => {
    return createBulkJob(
      {
        ...input,
        safeTestMode: true
      },
      { userId: ctx.user.id, source: "dashboard" }
    );
  })
});
var proxiesRouter = router({
  summary: adminProcedure.query(async () => {
    return getProxyModule();
  })
});
var workersRouter = router({
  summary: adminProcedure.query(async () => {
    return getWorkersModule();
  }),
  heartbeat: protectedProcedure.input(
    z5.object({
      workerNodeId: z5.number().int().positive(),
      status: z5.enum(["healthy", "degraded", "offline", "maintenance"]).optional(),
      activeJobs: z5.number().int().min(0).optional(),
      concurrency: z5.number().int().min(0).max(64).optional(),
      version: z5.string().max(64).optional()
    })
  ).mutation(async ({ input }) => {
    return updateWorkerNodeHeartbeat(input.workerNodeId, {
      status: input.status,
      activeJobs: input.activeJobs,
      version: input.version,
      concurrencyLimit: input.concurrency
    });
  }),
  /**
   * Start the global worker engine.
   * Initializes the pool and begins polling the job queue.
   */
  start: adminProcedure.input(
    z5.object({
      maxWorkers: z5.number().int().min(1).max(16).default(4),
      maxConcurrency: z5.number().int().min(1).max(64).default(2),
      pollIntervalMs: z5.number().int().min(1e3).max(6e4).default(5e3),
      heartbeatIntervalMs: z5.number().int().min(5e3).max(3e5).default(3e4)
    }).optional()
  ).mutation(async () => {
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
    const { queueSize, activeWorkers } = engine.workerPool;
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
        activeWorkers
      },
      workers: []
    };
  }),
  /**
   * Register a worker instance with the global pool.
   */
  register: adminProcedure.input(workerConfigSchema).mutation(async ({ input }) => {
    const engine = getGlobalEngine();
    const worker = engine.registerWorker({
      id: input.id,
      name: input.name,
      concurrency: input.concurrency,
      safeTestMode: input.safeTestMode,
      maxRetries: input.maxRetries,
      proxyRotateAfterN: input.proxyRotateAfterN,
      ssnTimeoutMs: input.ssnTimeoutMs,
      browserTimeoutMs: input.browserTimeoutMs
    });
    return { workerId: worker.id, name: worker.name, status: worker.status };
  }),
  /**
   * Deregister a worker from the global pool.
   */
  deregister: adminProcedure.input(z5.object({ workerId: z5.string().min(1).max(128) })).mutation(async ({ input }) => {
    const engine = getGlobalEngine();
    engine.deregisterWorker(input.workerId);
    return { workerId: input.workerId, deregistered: true };
  }),
  /**
   * Submit a job to an available worker in the pool.
   */
  submit: adminProcedure.input(workerSubmitJobSchema).mutation(async ({ input }) => {
    const engine = getGlobalEngine();
    const result = await engine.submitJob({
      jobPublicId: input.jobPublicId,
      payload: input.payload,
      proxyConfig: input.proxyConfig ? {
        providerHint: input.proxyConfig.providerHint,
        country: input.proxyConfig.country
      } : void 0,
      priority: input.priority,
      queueName: input.queueName,
      safeTestMode: input.safeTestMode,
      maxRetries: input.maxRetries
    });
    return result;
  })
});
var billingRouter = router({
  summary: adminProcedure.query(async () => {
    return getBillingModule();
  }),
  usage: protectedProcedure.query(async () => {
    return getApiUsageSummary();
  })
});
var telemetryRouter = router({
  summary: adminProcedure.input(metricFilterSchema.optional()).query(async () => {
    return getTelemetryModule();
  })
});
var revenueRouter = router({
  summary: adminProcedure.query(async () => {
    return getRevenueAnalyticsModule();
  })
});
var logsRouter = router({
  summary: adminProcedure.query(async () => {
    return getOperatorLogsModule();
  })
});
var platformRouter = router({
  overview: adminProcedure.query(async () => {
    return getAdminOverview();
  }),
  system: adminProcedure.query(async () => {
    return getSystemModule();
  }),
  safeTestBench: adminProcedure.query(async () => {
    return getSafeTestBench();
  })
});
var apiKeysRouter = router({
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
  })
});
var importedDataRouter = router({
  preview: adminProcedure.input(z5.object({ inputText: z5.string().min(1).max(2e5) })).mutation(async ({ input }) => {
    return previewImportedLeadText(input.inputText);
  }),
  createSafeBatch: adminProcedure.input(z5.object({ inputText: z5.string().min(1).max(2e5) })).mutation(async ({ ctx, input }) => {
    return createSafeImportedLeadBatch(input.inputText, {
      userId: ctx.user.id,
      source: "dashboard"
    });
  })
});
var botTextsRouter = router({
  summary: adminProcedure.query(async () => {
    return getBotTextsModule();
  }),
  update: adminProcedure.input(updateBotTextSchema).mutation(async ({ ctx, input }) => {
    return updateBotTextTemplate(input, { userId: ctx.user.id });
  })
});
var botRouter = router({
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
      parseMode: input.parseMode
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
      parseMode: input.parseMode
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
          parse_mode: input.parseMode !== "plain" ? input.parseMode : void 0
        })
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.description || `Telegram API responded with ${response.status}`);
    }
    return { ok: true, messageId: input.messageId };
  })
});
var broadcastsRouter = router({
  summary: adminProcedure.query(async () => {
    return getBroadcastsModule();
  }),
  create: adminProcedure.input(createBroadcastSchema).mutation(async ({ ctx, input }) => {
    return createBroadcastCampaign(input, { userId: ctx.user.id });
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
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
    })
  })
});

// server/restApi.ts
init_platform();
import express from "express";
import { createHash as createHash3 } from "node:crypto";
init_db();
function parseImportedTextBody(body) {
  if (!body || typeof body !== "object") return null;
  const inputText = body.inputText;
  if (typeof inputText !== "string") return null;
  const trimmed = inputText.trim();
  if (!trimmed || trimmed.length > 2e5) return null;
  return { inputText: trimmed };
}
function getRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function parseScopeFromToken(token) {
  if (token.startsWith("cs_vip_") || token.startsWith("vip_")) return "vip";
  if (token.startsWith("cs_admin_") || token.startsWith("admin_")) return "admin";
  if (token.startsWith("cs_bulk_") || token.startsWith("bulk_")) return "bulk";
  return "single";
}
function hashToken2(raw) {
  return createHash3("sha256").update(raw).digest("hex");
}
async function authenticateRequest(req) {
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
      authSource: "legacy_private_key"
    };
  }
  const record = await findApiKeyAuthRecordByHash(hashToken2(token));
  if (!record) {
    return null;
  }
  if (record.status !== "active") {
    return null;
  }
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  await touchApiKeyLastUsed(record.id, /* @__PURE__ */ new Date());
  return {
    token,
    apiKeyId: record.id,
    keyPrefix: record.keyPrefix,
    scope: parseScopeFromToken(token) === record.scope ? record.scope : record.scope,
    userId: record.userId,
    rpmLimit: record.rpmLimit,
    dailyLimit: record.dailyLimit,
    authSource: "api_key"
  };
}
async function applyRateLimit(client) {
  const derived = deriveRateLimit(client.scope);
  const limit = {
    rpm: client.rpmLimit ?? derived.rpm,
    daily: client.dailyLimit ?? derived.daily
  };
  const minuteHits = await incrementRateLimitHits(client.keyPrefix, "minute");
  const dailyHits = await incrementDailyHits(client.keyPrefix);
  if (minuteHits > limit.rpm) {
    return {
      allowed: false,
      limit,
      current: minuteHits,
      dailyHits
    };
  }
  return {
    allowed: true,
    limit,
    current: minuteHits,
    dailyHits
  };
}
function sendValidationError(res, requestId, message, details) {
  return res.status(400).json(buildApiError(requestId, "VALIDATION_ERROR", message, false, details));
}
function sendUnauthorized(res, requestId) {
  return res.status(401).json(buildApiError(requestId, "UNAUTHORIZED", "Bearer token is required.", false));
}
function sendForbidden(res, requestId, message) {
  return res.status(403).json(buildApiError(requestId, "FORBIDDEN", message, false));
}
function sendRateLimit(res, requestId, meta) {
  return res.status(429).json(buildApiError(requestId, "RATE_LIMITED", "Rate limit exceeded for this API key.", true, meta));
}
function registerRestApi(app) {
  const router2 = express.Router();
  router2.get("/health", async (_req, res) => {
    const requestId = getRequestId();
    const system = await getSystemModule();
    return res.json(buildApiResponse(requestId, system.health, { public: true }));
  });
  router2.use(async (req, res, next) => {
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
        currentHits: rate.current
      });
    }
    res.locals.apiClient = client;
    res.locals.rateLimit = rate.limit;
    next();
  });
  router2.post("/requests/single", async (req, res) => {
    const requestId = res.locals.requestId;
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid single request payload.", {
        issues: parsed.error.flatten()
      });
    }
    const client = res.locals.apiClient;
    if (client.scope === "single" || client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createSingleJob(parsed.data, { userId: client.userId ?? void 0, source: "api" });
      return res.json({ ...result, requestId });
    }
    return sendForbidden(res, requestId, "API key scope does not allow single requests.");
  });
  router2.post("/requests/bulk", async (req, res) => {
    const requestId = res.locals.requestId;
    const parsed = createBulkJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid bulk request payload.", {
        issues: parsed.error.flatten()
      });
    }
    const client = res.locals.apiClient;
    if (client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createBulkJob(parsed.data, { userId: client.userId ?? void 0, source: "api" });
      return res.json({ ...result, requestId });
    }
    return sendForbidden(res, requestId, "API key scope does not allow bulk requests.");
  });
  router2.post("/requests/vip", async (req, res) => {
    const requestId = res.locals.requestId;
    const parsed = createJobSchema.safeParse({ ...req.body, requestMode: "vip" });
    if (!parsed.success) {
      return sendValidationError(res, requestId, "Invalid VIP request payload.", {
        issues: parsed.error.flatten()
      });
    }
    const client = res.locals.apiClient;
    if (client.scope === "vip" || client.scope === "admin") {
      const result = await createSingleJob(parsed.data, { userId: client.userId ?? void 0, source: "api" });
      return res.json({ ...result, requestId, meta: { ...result.meta, vip: true } });
    }
    return sendForbidden(res, requestId, "VIP scope is required for this endpoint.");
  });
  router2.post("/imported-data/preview", async (req, res) => {
    const requestId = res.locals.requestId;
    const parsed = parseImportedTextBody(req.body);
    if (!parsed) {
      return sendValidationError(res, requestId, "Invalid imported data payload.", {
        expected: { inputText: "non-empty string up to 200000 chars" }
      });
    }
    const result = await previewImportedLeadText(parsed.inputText);
    return res.json(buildApiResponse(requestId, result, { piiRedacted: true, safePreview: true }));
  });
  router2.post("/imported-data/safe-batch", async (req, res) => {
    const requestId = res.locals.requestId;
    const parsed = parseImportedTextBody(req.body);
    if (!parsed) {
      return sendValidationError(res, requestId, "Invalid imported data payload.", {
        expected: { inputText: "non-empty string up to 200000 chars" }
      });
    }
    const client = res.locals.apiClient;
    if (client.scope === "bulk" || client.scope === "vip" || client.scope === "admin") {
      const result = await createSafeImportedLeadBatch(parsed.inputText, {
        userId: client.userId ?? void 0,
        source: "api"
      });
      return res.json({ ...result, requestId, meta: { ...result.meta, piiRedacted: true, importedFormat: true } });
    }
    return sendForbidden(res, requestId, "Bulk, VIP or admin scope is required for safe imported batches.");
  });
  router2.get("/jobs/:publicId", async (req, res) => {
    const requestId = res.locals.requestId;
    const details = await getJobDetails(req.params.publicId);
    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found.", false));
    }
    return res.json(buildApiResponse(requestId, details.job, { eventCount: details.events.length }));
  });
  router2.get("/jobs/:publicId/events", async (req, res) => {
    const requestId = res.locals.requestId;
    const details = await getJobDetails(req.params.publicId);
    if (!details) {
      return res.status(404).json(buildApiError(requestId, "NOT_FOUND", "Job not found.", false));
    }
    return res.json(buildApiResponse(requestId, details.events, { publicId: details.job.publicId }));
  });
  router2.get("/usage/summary", async (_req, res) => {
    const requestId = res.locals.requestId;
    const usage = await getApiUsageSummary();
    return res.json(buildApiResponse(requestId, usage));
  });
  app.use("/api/v1", router2);
}

// server/_core/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";
var BCRYPT_ROUNDS = 12;
var ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
async function createPasswordHash(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
var hashPassword = createPasswordHash;
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function createToken(username, role, secret) {
  const secretKey = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1e3);
  const expirationSeconds = now + ONE_YEAR_SECONDS;
  return new SignJWT({ username, role }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt(now).setExpirationTime(expirationSeconds).sign(secretKey);
}
async function verifyToken(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"]
    });
    const username = payload["username"];
    const role = payload["role"];
    if (typeof username !== "string" || username.length === 0) {
      return null;
    }
    return { username, role: role ?? "admin" };
  } catch {
    return null;
  }
}
function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7) || null;
}

// server/_core/context.ts
init_env();
init_db();
async function createContext(opts) {
  let user = null;
  try {
    const req = opts.req;
    const authHeader = req.headers?.authorization;
    const token = extractBearerToken(authHeader);
    if (token && ENV.jwtSecret) {
      const payload = await verifyToken(token, ENV.jwtSecret);
      if (payload && payload.role === "admin") {
        user = await getAdminByUsername(payload.username);
      }
    }
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express2 from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
function resolveClientRoot() {
  const devPath = path2.resolve(process.cwd(), "client");
  if (fs2.existsSync(devPath)) {
    return devPath;
  }
  return path2.resolve(import.meta.dirname, "..", "..", "client");
}
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientRoot = resolveClientRoot();
      const clientTemplate = path2.resolve(clientRoot, "index.html");
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPublic = path2.resolve(import.meta.dirname, "..", "..", "dist", "public");
  const devClient = path2.resolve(process.cwd(), "client");
  const distPath = fs2.existsSync(distPublic) ? distPublic : devClient;
  if (!fs2.existsSync(distPath)) {
    console.error(`Could not find the static directory: ${distPath}`);
  }
  app.use(express2.static(distPath));
  app.use("*", (_req, res) => {
    const indexPath = path2.resolve(distPath, "index.html");
    if (fs2.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).json({ error: "Client build not found", path: distPath });
    }
  });
}

// server/_core/index.ts
init_env();
init_db();
init_runtimeStore();

// server/_core/botWebhook.ts
init_env();
var pendingSsnJobs = /* @__PURE__ */ new Map();
var SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;
function isSsnInput(text2) {
  return SSN_REGEX.test(text2.trim());
}
function getBotToken() {
  return ENV.botToken?.trim() ?? "";
}
function buildWelcomeMessage(texts) {
  return texts.welcome ?? "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C! \u0411\u043E\u0442 \u0433\u043E\u0442\u043E\u0432 \u043F\u043E\u043C\u043E\u0447\u044C \u0441 \u0437\u0430\u043F\u0440\u043E\u0441\u0430\u043C\u0438 \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u043E\u0433\u043E \u0441\u043A\u043E\u0440\u0430. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0439 \u0444\u043E\u0440\u043C\u0435.";
}
function buildHelpMessage() {
  return "\u{1F4CB} <b>\u0421\u043F\u0440\u0430\u0432\u043A\u0430</b>\n\n\u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0441 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 (\u0424\u0418\u041E, \u0430\u0434\u0440\u0435\u0441, \u0442\u0435\u043B\u0435\u0444\u043E\u043D, email, DOB, SSN) \u2014 \u0431\u043E\u0442 \u0441\u043E\u0437\u0434\u0430\u0441\u0442 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0439 \u0441\u043A\u043E\u0440.\n\n\u041A\u043E\u043C\u0430\u043D\u0434\u044B:\n\u2022 /start \u2014 \u043F\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435\n\u2022 /help  \u2014 \u044D\u0442\u0430 \u0441\u043F\u0440\u0430\u0432\u043A\u0430\n\u2022 /status &lt;job_id&gt; \u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u043D\u0438\u044F\n\n\u0424\u043E\u0440\u043C\u0430\u0442 SSN: <code>XXX-XX-XXXX</code>";
}
function buildJobAcceptedMessage(publicId) {
  return `\u2705 <b>\u0417\u0430\u043F\u0440\u043E\u0441 \u043F\u0440\u0438\u043D\u044F\u0442</b>

ID: <code>${publicId}</code>
\u0421\u0442\u0430\u0442\u0443\u0441: \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438

\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u0438\u0434\u0451\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435\u043C.`;
}
function buildJobResultMessage(result) {
  const score = result.creditScore ?? "\u2014";
  const quality = result.productScore;
  const emoji = result.creditScore !== null ? "\u2705" : "\u26A0\uFE0F";
  return `${emoji} <b>\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442</b>

\u2022 \u041A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0439 \u0441\u043A\u043E\u0440: <code>${score}</code>
\u2022 \u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u0434\u0430\u043D\u043D\u044B\u0445: ${quality}/20
\u2022 \u0421\u0442\u0430\u0442\u0443\u0441: ${result.status}
\u2022 \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ${result.source}
\u2022 \u0426\u0435\u043D\u0430: $${result.priceUsd.toFixed(2)}`;
}
function buildSsnRequestMessage() {
  return "\u{1F511} \u0414\u043B\u044F \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u044F \u043D\u0443\u0436\u0435\u043D \u0432\u0430\u0448 SSN.\n\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435: <code>XXX-XX-XXXX</code>";
}
async function tgSendMessage(chatId, text2) {
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not configured, skipping sendMessage");
    return;
  }
  try {
    await sendTelegramMessage({ botToken: token, chatId, text: text2 });
  } catch (err) {
    console.error("[BotWebhook] sendMessage failed:", err);
  }
}
async function processIncomingMessage(msg) {
  const chatId = String(msg.chat.id);
  const text2 = (msg.text ?? "").trim();
  if (text2.startsWith("/start")) {
    const texts = await getBotTextTemplate("welcome");
    await tgSendMessage(chatId, buildWelcomeMessage({ welcome: texts?.body ?? null }));
    return;
  }
  if (text2.startsWith("/help")) {
    await tgSendMessage(chatId, buildHelpMessage());
    return;
  }
  if (text2.startsWith("/status")) {
    await tgSendMessage(chatId, "\u{1F4CB} \u0414\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0430\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C \u0438\u043B\u0438 API /api/v1/jobs/:id");
    return;
  }
  const pendingJobId = pendingSsnJobs.get(chatId);
  if (pendingJobId) {
    if (!isSsnInput(text2)) {
      await tgSendMessage(chatId, buildSsnRequestMessage());
      return;
    }
    pendingSsnJobs.delete(chatId);
    console.info(`[BotWebhook] SSN received for job ${pendingJobId}, chat ${chatId}. TODO: inject SSN into job context.`);
    await tgSendMessage(
      chatId,
      `\u{1F511} SSN \u043F\u0440\u0438\u043D\u044F\u0442. \u0417\u0430\u0434\u0430\u043D\u0438\u0435 <code>${pendingJobId}</code> \u0431\u0443\u0434\u0435\u0442 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E.

(\u0418\u043D\u044A\u0435\u043A\u0446\u0438\u044F SSN \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u2014 integration point \u0434\u043B\u044F worker pool.)`
    );
    return;
  }
  if (!text2) {
    await tgSendMessage(chatId, buildHelpMessage());
    return;
  }
  const parsed = parseImportedLeadText(text2);
  if (parsed.length > 0) {
    const firstRecord = toSafeImportedLeadRecord(parsed[0]);
    const payload = {
      sourceLabel: firstRecord.sourceLabel,
      city: firstRecord.city,
      state: firstRecord.state,
      postalCode: firstRecord.postalCode,
      phoneNumbers: firstRecord.phoneNumbers,
      emailDomain: firstRecord.emailDomain,
      dobText: firstRecord.dobText,
      hasSsn: firstRecord.hasSsn,
      age: firstRecord.age,
      flags: firstRecord.flags,
      completenessScore: firstRecord.completenessScore,
      normalizedTarget: firstRecord.normalizedTarget
    };
    const result = await createSingleJob(
      {
        requestMode: "single",
        queueName: "telegram",
        priority: 80,
        payload,
        safeTestMode: true
      },
      { source: "telegram" }
    );
    const publicId = result.data.job.publicId;
    const resultJson = result.data.job.resultJson;
    const oneCs = resultJson?.oneCsResult ?? null;
    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId));
    if (oneCs) {
      await tgSendMessage(chatId, buildJobResultMessage({
        creditScore: oneCs.creditScore ?? null,
        productScore: oneCs.productScore ?? 0,
        status: oneCs.status ?? "unknown",
        source: oneCs.source ?? "unknown",
        priceUsd: oneCs.priceUsd ?? 0
      }));
    }
  } else {
    const result = await createSingleJob(
      {
        requestMode: "single",
        queueName: "telegram",
        priority: 80,
        payload: { rawInput: text2, source: "telegram" },
        safeTestMode: true
      },
      { source: "telegram" }
    );
    const publicId = result.data.job.publicId;
    const resultJson = result.data.job.resultJson;
    const oneCs = resultJson?.oneCsResult ?? null;
    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId));
    if (oneCs) {
      await tgSendMessage(chatId, buildJobResultMessage({
        creditScore: oneCs.creditScore ?? null,
        productScore: oneCs.productScore ?? 0,
        status: oneCs.status ?? "unknown",
        source: oneCs.source ?? "unknown",
        priceUsd: oneCs.priceUsd ?? 0
      }));
    }
  }
}
async function handleBotWebhook(req, res) {
  if (req.method === "GET") {
    res.json({ ok: true, mode: "webhook" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not set \u2014 webhook endpoint accessible but bot messages will be silently dropped.");
  }
  const update = req.body;
  if (!update || typeof update.update_id !== "number") {
    res.json({ ok: false, description: "invalid_payload" });
    return;
  }
  res.json({ ok: true });
  if (update.message && update.message.text !== void 0) {
    void processIncomingMessage(update.message).catch((err) => {
      console.error("[BotWebhook] Error processing message:", err);
    });
  }
}

// server/_core/index.ts
import swaggerUi from "swagger-ui-express";

// server/_core/openapi.ts
var spec = {
  openapi: "3.0.3",
  info: {
    title: "ONE CS Platform REST API",
    version: "1.0.0",
    description: "External REST API for the ONE CS browser-automation / credit-score platform. All authenticated endpoints require a `Bearer <token>` in the `Authorization` header. Rate limits depend on the API key scope (single / bulk / vip / admin).",
    contact: {
      name: "ONE CS Platform Team"
    }
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current API version"
    }
  ],
  tags: [
    { name: "public", description: "Public endpoints (no authentication required)" },
    { name: "requests", description: "Job creation requests" },
    { name: "jobs", description: "Job status and event retrieval" },
    { name: "imported-data", description: "Imported lead text parsing and safe batch ingestion" },
    { name: "usage", description: "API usage and billing summary" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["public"],
        operationId: "getHealth",
        summary: "Service health check",
        description: "Returns the overall health status, DB connectivity, and proxy status. No authentication required.",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: {
                  ok: true,
                  requestId: "req_123456_abc",
                  data: {
                    status: "healthy",
                    db: "connected",
                    proxy: { evomi: { ok: true, latencyMs: 42 } },
                    version: "1.0.0"
                  },
                  meta: { public: true }
                }
              }
            }
          },
          "503": {
            description: "Service is degraded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/requests/single": {
      post: {
        tags: ["requests"],
        operationId: "createSingleRequest",
        summary: "Submit a single credit-score request",
        description: "Accepts a single lead payload and queues a job for processing. Requires a `single`, `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SingleRequestBody" },
              example: {
                requestMode: "single",
                targetLabel: "lead-001",
                queueName: "default",
                priority: 100,
                payload: {
                  firstName: "John",
                  lastName: "Doe",
                  address: "123 Main St, New York, NY 10001",
                  phone: "+12025551234",
                  email: "john.doe@example.com",
                  dob: "1985-06-15",
                  ssn: "123-45-6789",
                  creditScore: 720
                },
                proxy: {
                  country: "US",
                  protocol: "http",
                  sessionMode: "rotating"
                },
                safeTestMode: false
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Request accepted and job queued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleResponse" }
              }
            }
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" }
              }
            }
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" }
              }
            }
          },
          "403": {
            description: "Forbidden \u2014 API key scope too restrictive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" }
              }
            }
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
                example: {
                  ok: false,
                  requestId: "req_abc",
                  error: {
                    code: "RATE_LIMITED",
                    message: "Rate limit exceeded for this API key.",
                    retryable: true,
                    details: { rpm: 60, currentHits: 61 }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/requests/bulk": {
      post: {
        tags: ["requests"],
        operationId: "createBulkRequest",
        summary: "Submit a bulk batch of credit-score requests",
        description: "Accepts up to 1,000 lead items in a single request and creates a batch. Each item becomes an individual job. Requires a `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BulkRequestBody" },
              example: {
                queueName: "bulk",
                priority: 120,
                items: [
                  { externalId: "ext-001", payload: { firstName: "Alice", lastName: "Smith", creditScore: 680 } },
                  { externalId: "ext-002", payload: { firstName: "Bob", lastName: "Jones", creditScore: 550 } }
                ],
                proxy: { country: "US" },
                safeTestMode: true
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Bulk batch accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkResponse" }
              }
            }
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/requests/vip": {
      post: {
        tags: ["requests"],
        operationId: "createVipRequest",
        summary: "Submit a VIP-priority single request",
        description: "Same as `/requests/single` but with VIP priority and a higher rate limit. Requires a `vip` or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SingleRequestBody" },
              example: {
                requestMode: "vip",
                queueName: "vip",
                priority: 900,
                payload: { firstName: "Alice", lastName: "Smith", creditScore: 800 },
                safeTestMode: false
              }
            }
          }
        },
        responses: {
          "200": {
            description: "VIP request accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VipResponse" }
              }
            }
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden \u2014 VIP scope required", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/imported-data/preview": {
      post: {
        tags: ["imported-data"],
        operationId: "previewImportedData",
        summary: "Preview parsed imported lead text",
        description: "Parses raw multi-block lead text input and returns a completeness summary with PII redacted. No external calls are made.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportedDataBody" },
              example: {
                inputText: "John Doe\n123 Main St, Austin, TX 78701\n+1 512-555-0101\njohndoe@email.com\nDOB: 1985-03-22\nScore: 700"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Preview parsed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImportedDataPreviewResponse" }
              }
            }
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/imported-data/safe-batch": {
      post: {
        tags: ["imported-data"],
        operationId: "createSafeImportedBatch",
        summary: "Create a safe-test batch from imported lead text",
        description: "Parses raw lead text and creates a batch of jobs in safe-test mode (no external calls). PII is redacted from stored payloads. Requires `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportedDataBody" }
            }
          }
        },
        responses: {
          "200": {
            description: "Safe batch created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SafeBatchResponse" }
              }
            }
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden \u2014 bulk/VIP/admin scope required", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/jobs/{publicId}": {
      get: {
        tags: ["jobs"],
        operationId: "getJobDetails",
        summary: "Get job details by public ID",
        description: "Returns the full job record including status, result, and proxy details.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "publicId",
            in: "path",
            required: true,
            description: "The public job identifier (format: job_<hex>)",
            schema: { type: "string", example: "job_a1b2c3d4e5f6" }
          }
        ],
        responses: {
          "200": {
            description: "Job found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobDetailsResponse" }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "404": {
            description: "Job not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
                example: {
                  ok: false,
                  requestId: "req_xyz",
                  error: { code: "NOT_FOUND", message: "Job not found.", retryable: false }
                }
              }
            }
          }
        }
      }
    },
    "/jobs/{publicId}/events": {
      get: {
        tags: ["jobs"],
        operationId: "getJobEvents",
        summary: "Get job execution events",
        description: "Returns the chronological list of events (lifecycle, errors, retries) for a job.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "publicId",
            in: "path",
            required: true,
            description: "The public job identifier",
            schema: { type: "string", example: "job_a1b2c3d4e5f6" }
          }
        ],
        responses: {
          "200": {
            description: "Job events returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobEventsResponse" }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "404": { description: "Job not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/usage/summary": {
      get: {
        tags: ["usage"],
        operationId: "getUsageSummary",
        summary: "Get API usage summary for the current period",
        description: "Returns aggregated usage metrics (requests, browser runs, proxy traffic, revenue, COGS) for the current billing period, segmented by API key.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Usage summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsageSummaryResponse" }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "Pass your API key as `Bearer <token>` in the Authorization header. Keys are created via the dashboard (Billing > API Keys). Scopes: `single` (60 rpm), `bulk` (120 rpm), `vip` (300 rpm), `admin` (600 rpm)."
      }
    },
    schemas: {
      // ─── Common ────────────────────────────────────────────────────────────
      ApiError: {
        type: "object",
        description: "Standard API error response",
        required: ["ok", "requestId", "error"],
        properties: {
          ok: { type: "boolean", enum: [false], description: "Always `false` for error responses" },
          requestId: { type: "string", description: "Unique request identifier (format: req_<ts>_<random>)" },
          error: {
            type: "object",
            required: ["code", "message", "retryable"],
            properties: {
              code: {
                type: "string",
                enum: ["UNAUTHORIZED", "FORBIDDEN", "VALIDATION_ERROR", "RATE_LIMITED", "NOT_FOUND", "INTERNAL_ERROR"],
                description: "Machine-readable error code"
              },
              message: { type: "string", description: "Human-readable error description" },
              retryable: { type: "boolean", description: "Whether the request can be retried without modification" },
              details: {
                type: "object",
                description: "Additional context (present for VALIDATION_ERROR and RATE_LIMITED)",
                additionalProperties: true
              }
            }
          }
        }
      },
      BaseJob: {
        type: "object",
        description: "Core job record fields shared across endpoints",
        properties: {
          id: { type: "integer", description: "Internal DB ID" },
          publicId: { type: "string", description: "Public job identifier (format: job_<hex>)" },
          userId: { type: ["integer", "null"], description: "Owner user ID" },
          source: { type: "string", enum: ["dashboard", "api", "telegram", "system", "testbench"], description: "Submission source" },
          requestMode: { type: "string", enum: ["single", "bulk", "vip"], description: "Processing mode" },
          status: { type: "string", enum: ["queued", "running", "succeeded", "failed", "canceled", "waiting_retry"], description: "Current job status" },
          queueName: { type: "string", description: "Queue name (e.g. default, bulk, vip)" },
          priority: { type: "integer", description: "Queue priority (1-1000, higher = more urgent)" },
          targetLabel: { type: ["string", "null"], description: "Optional human-readable label" },
          attemptCount: { type: "integer", description: "Number of execution attempts" },
          maxAttempts: { type: "integer", description: "Maximum allowed attempts" },
          errorCode: { type: ["string", "null"], description: "Error code if status is failed" },
          errorMessage: { type: ["string", "null"], description: "Error message if status is failed" },
          createdAt: { type: "string", format: "date-time" },
          startedAt: { type: ["string", "null"], format: "date-time" },
          completedAt: { type: ["string", "null"], format: "date-time" },
          costEstimateUsd: { type: "string", description: "Estimated cost in USD (string to preserve precision)" },
          cogsUsd: { type: "string", description: "Cost of goods sold in USD" },
          resultJson: {
            type: "object",
            description: "Result payload containing ONE CS scoring output",
            additionalProperties: true
          }
        }
      },
      // ─── Request bodies ─────────────────────────────────────────────────────
      ProxyConfig: {
        type: "object",
        description: "Optional proxy configuration for a job",
        properties: {
          country: { type: "string", maxLength: 8, description: "ISO country code (e.g. US, CA)", example: "US" },
          state: { type: "string", maxLength: 64, description: "State/region hint" },
          city: { type: "string", maxLength: 128, description: "City hint" },
          protocol: { type: "string", enum: ["http", "socks5"], default: "http" },
          sessionMode: { type: "string", enum: ["rotating", "sticky", "hard_sticky"], default: "rotating" },
          stickyTtlMinutes: { type: "integer", minimum: 1, maximum: 1440 },
          providerHint: { type: "string", maxLength: 64, description: "Preferred proxy provider code" },
          costCeilingUsd: { type: "number", minimum: 0 },
          maxTransportRetries: { type: "integer", minimum: 0, maximum: 10, default: 2 },
          maxProviderSwitches: { type: "integer", minimum: 0, maximum: 10, default: 1 }
        }
      },
      SingleRequestBody: {
        type: "object",
        required: ["requestMode", "payload"],
        properties: {
          requestMode: {
            type: "string",
            enum: ["single", "bulk", "vip"],
            description: "Request mode (ignored for /requests/vip \u2014 it is forced internally)"
          },
          targetLabel: { type: "string", maxLength: 191, description: "Human-readable job label" },
          queueName: { type: "string", maxLength: 64, default: "default" },
          priority: { type: "integer", minimum: 1, maximum: 1e3, default: 100 },
          payload: {
            type: "object",
            description: "Lead data payload. Common fields: firstName, lastName, address, phone, email, dob, ssn, creditScore",
            additionalProperties: true
          },
          proxy: { $ref: "#/components/schemas/ProxyConfig" },
          profilePolicy: { type: "string", maxLength: 128, description: "Browser fingerprinting profile name" },
          fingerprintProfile: { type: "string", maxLength: 128, description: "Explicit fingerprint profile override" },
          safeTestMode: { type: "boolean", default: false, description: "If true, executes in safe-test bench (no external calls)" }
        }
      },
      BulkRequestBody: {
        type: "object",
        required: ["items"],
        properties: {
          queueName: { type: "string", maxLength: 64, default: "bulk" },
          priority: { type: "integer", minimum: 1, maximum: 1e3, default: 120 },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 1e3,
            description: "Bulk items (max 1,000). Each item becomes a separate job.",
            items: {
              type: "object",
              properties: {
                externalId: { type: "string", maxLength: 128, description: "External reference ID for this item" },
                payload: {
                  type: "object",
                  additionalProperties: true,
                  description: "Lead data payload for this item"
                }
              }
            }
          },
          proxy: { $ref: "#/components/schemas/ProxyConfig" },
          safeTestMode: { type: "boolean", default: false }
        }
      },
      ImportedDataBody: {
        type: "object",
        required: ["inputText"],
        properties: {
          inputText: {
            type: "string",
            maxLength: 2e5,
            description: "Raw multi-block lead text. Each block represents one record. Supported fields: Name, Address, Phone, Email, DOB, SSN, Credit Score. PII is redacted in responses.",
            example: "John Doe\n123 Main St, Austin, TX 78701\n+1 512-555-0101\njohndoe@email.com\nDOB: 1985-03-22\nScore: 700\n\nJane Smith\n456 Elm St, Austin, TX 78702\n+1 512-555-0202\njanesmith@email.com\nDOB: 1990-07-10\nScore: 650"
          }
        }
      },
      // ─── Responses ───────────────────────────────────────────────────────────
      HealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["healthy", "degraded"] },
              db: { type: "string", enum: ["connected", "disconnected"] },
              proxy: { type: "object", additionalProperties: true },
              version: { type: "string" }
            }
          },
          meta: { type: "object", properties: { public: { type: "boolean" } } }
        }
      },
      SingleResponse: {
        type: "object",
        description: "Response for a single job creation request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              job: { $ref: "#/components/schemas/BaseJob" },
              events: { type: "array", items: { $ref: "#/components/schemas/JobEvent" } }
            }
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              persisted: { type: "boolean" },
              executionMode: { type: "string", enum: ["safe_test", "queued_runtime"] }
            }
          }
        }
      },
      BulkResponse: {
        type: "object",
        description: "Response for a bulk batch creation request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              batchId: { type: "string", description: "Batch identifier (format: batch_<hex>)" },
              itemCount: { type: "integer", description: "Number of items in the batch" },
              jobs: { type: "array", items: { $ref: "#/components/schemas/BaseJob" } }
            }
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              queueName: { type: "string" }
            }
          }
        }
      },
      VipResponse: {
        type: "object",
        description: "Response for a VIP-priority single request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              job: { $ref: "#/components/schemas/BaseJob" },
              events: { type: "array", items: { $ref: "#/components/schemas/JobEvent" } }
            }
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              persisted: { type: "boolean" },
              executionMode: { type: "string" },
              vip: { type: "boolean" }
            }
          }
        }
      },
      ImportedDataPreviewResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              totalRecords: { type: "integer", description: "Total parsed records" },
              sourceLabels: { type: "array", items: { type: "string" } },
              stateBreakdown: { type: "object", additionalProperties: { type: "integer" } },
              withPhone: { type: "integer", description: "Records with a phone number" },
              withEmailDomain: { type: "integer", description: "Records with an email domain" },
              withDob: { type: "integer", description: "Records with a date of birth" },
              withSsnMarker: { type: "integer", description: "Records with an SSN marker" },
              averageCompletenessScore: { type: "number", description: "Average completeness score (0-1)" },
              sampleRecords: { type: "array", items: { type: "object", additionalProperties: true } },
              safePayloads: { type: "array", items: { type: "object", additionalProperties: true } }
            }
          },
          meta: {
            type: "object",
            properties: {
              piiRedacted: { type: "boolean" },
              safePreview: { type: "boolean" }
            }
          }
        }
      },
      SafeBatchResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              batchId: { type: "string" },
              itemCount: { type: "integer" },
              jobs: { type: "array", items: { $ref: "#/components/schemas/BaseJob" } }
            }
          },
          meta: {
            type: "object",
            properties: {
              piiRedacted: { type: "boolean" },
              importedFormat: { type: "boolean" },
              safeTestMode: { type: "boolean" }
            }
          }
        }
      },
      JobEvent: {
        type: "object",
        description: "A single job lifecycle event",
        properties: {
          id: { type: "integer" },
          jobId: { type: "integer" },
          type: { type: "string", description: "Event type (e.g. job.created, worker.completed)" },
          severity: { type: "string", enum: ["info", "warn", "error"] },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      JobDetailsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: { $ref: "#/components/schemas/BaseJob" },
          meta: {
            type: "object",
            properties: {
              eventCount: { type: "integer", description: "Total number of events for this job" }
            }
          }
        }
      },
      JobEventsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/JobEvent" }
          },
          meta: {
            type: "object",
            properties: {
              publicId: { type: "string" }
            }
          }
        }
      },
      UsageSummaryResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              apiKeys: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    label: { type: "string" },
                    scope: { type: "string" },
                    status: { type: "string" },
                    rpmLimit: { type: "integer" },
                    dailyLimit: { type: "integer" },
                    createdAt: { type: "string", format: "date-time" }
                  }
                }
              },
              usageSummary: {
                type: "object",
                properties: {
                  currentPeriod: { type: "string" },
                  requests: { type: "integer" },
                  browserRuns: { type: "integer" },
                  proxyTrafficGb: { type: "number" },
                  cogsUsd: { type: "number" },
                  revenueUsd: { type: "number" },
                  marginUsd: { type: "number" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var openapi_default = spec;

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function ensureDefaultAdmin() {
  if (!ENV.adminPasswordHash && ENV.adminUsername) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "admin123";
    const hash = await hashPassword(defaultPassword);
    await upsertAdmin(ENV.adminUsername, hash, "admin");
    initRuntimeDefaultAdmin(ENV.adminUsername, hash);
    console.log(`[Auth] Default admin created. Change password via /api/auth/change-password`);
  }
}
async function registerAuthRoutes(app) {
  await ensureDefaultAdmin();
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const admin = await getAdminByUsername(username);
    if (!admin) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = await createToken(admin.username, admin.role, ENV.jwtSecret);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS
    });
    res.json({
      token,
      user: { id: admin.id, username: admin.username, role: admin.role }
    });
  });
  app.post("/api/auth/change-password", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, ENV.jwtSecret);
    if (!payload || payload.role !== "admin") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }
    const username = payload.username;
    const admin = await getAdminByUsername(username);
    if (!admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const valid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await upsertAdmin(username, newHash, "admin");
    const newToken = await createToken(username, "admin", ENV.jwtSecret);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, newToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS
    });
    res.json({ success: true, token: newToken });
  });
  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, ENV.jwtSecret);
    if (!payload || payload.role !== "admin") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = await getAdminByUsername(payload.username);
    if (!admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ id: admin.id, username: admin.username, role: admin.role });
  });
}
async function startServer() {
  const app = express3();
  const server = createServer(app);
  app.use(express3.json({ limit: "50mb" }));
  app.use(express3.urlencoded({ limit: "50mb", extended: true }));
  await registerAuthRoutes(app);
  app.get("/health", async (_req, res) => {
    let proxyResult = {};
    try {
      proxyResult = await healthCheck();
    } catch (err) {
      proxyResult = { error: String(err) };
    }
    let dbHealthy = false;
    try {
      const jobs2 = await listJobs();
      dbHealthy = Array.isArray(jobs2);
    } catch {
      dbHealthy = false;
    }
    const hasProxyError = "error" in proxyResult;
    const status = dbHealthy && !hasProxyError ? 200 : 503;
    res.status(status).json({
      status: status === 200 ? "healthy" : "degraded",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      db: dbHealthy ? "connected" : "disconnected",
      proxy: proxyResult,
      version: "1.0.0"
    });
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  app.all("/api/bot/webhook", handleBotWebhook);
  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json(openapi_default);
  });
  registerRestApi(app);
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi_default, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true
    }
  }));
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const isDevelopment = process.env.NODE_ENV === "development";
  const port = isDevelopment ? await findAvailablePort(preferredPort) : preferredPort;
  if (isDevelopment && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.on("error", (error) => {
    console.error(`Failed to start server on port ${port}`, error);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
