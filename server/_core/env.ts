export const ENV = {
  // Server
  port: parseInt(process.env.PORT ?? "3000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",

  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Auth
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",  // bcrypt hash
  privateApiKey: process.env.PRIVATE_API_KEY ?? "",           // for external callers

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
  botToken: process.env.BOT_TOKEN ?? "",
};