import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { registerRestApi } from "../restApi";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { createToken, hashPassword, verifyPassword, verifyToken } from "./auth";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import * as db from "../db";
import { initRuntimeDefaultAdmin } from "../runtimeStore";
import { healthCheck as proxyHealthCheck } from "./proxy";
import { handleBotWebhook } from "./botWebhook";
import swaggerUi from "swagger-ui-express";
import openapiSpec from "./openapi";
import type { Request, Response } from "express";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// --- Auth routes ---

async function ensureDefaultAdmin() {
  if (!ENV.adminPasswordHash && ENV.adminUsername) {
    // Generate default password hash on first run
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "admin123";
    const hash = await hashPassword(defaultPassword);
    await db.upsertAdmin(ENV.adminUsername, hash, "admin");
    // Also init runtimeStore so login works without DB
    initRuntimeDefaultAdmin(ENV.adminUsername, hash);
    console.log(`[Auth] Default admin created. Change password via /api/auth/change-password`);
  }
}

async function registerAuthRoutes(app: express.Express) {
  await ensureDefaultAdmin();

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const admin = await db.getAdminByUsername(username);
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
      maxAge: ONE_YEAR_MS,
    });

    res.json({
      token,
      user: { id: admin.id, username: admin.username, role: admin.role },
    });
  });

  // POST /api/auth/change-password
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    // Check Authorization header first (Bearer token)
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

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    const username = payload.username;
    const admin = await db.getAdminByUsername(username);

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
    await db.upsertAdmin(username, newHash, "admin");

    // Re-issue token with updated expiry
    const newToken = await createToken(username, "admin", ENV.jwtSecret);
    const cookieOptions = getSessionCookieOptions(req);

    res.cookie(COOKIE_NAME, newToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });

    res.json({ success: true, token: newToken });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req: Request, res: Response) => {
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

    const admin = await db.getAdminByUsername(payload.username);
    if (!admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({ id: admin.id, username: admin.username, role: admin.role });
  });
}

// --- End auth routes ---

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Auth API
  await registerAuthRoutes(app);

  // Health check endpoint
  app.get("/health", async (_req: Request, res: Response) => {
    let proxyResult: object = {};
    try {
      proxyResult = await proxyHealthCheck();
    } catch (err) {
      proxyResult = { error: String(err) };
    }

    let dbHealthy = false;
    try {
      const jobs = await db.listJobs();
      dbHealthy = Array.isArray(jobs);
    } catch {
      dbHealthy = false;
    }

    const hasProxyError = "error" in proxyResult;
    const status = dbHealthy && !hasProxyError ? 200 : 503;
    res.status(status).json({
      status: status === 200 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      db: dbHealthy ? "connected" : "disconnected",
      proxy: proxyResult,
      version: "1.0.0",
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Telegram bot webhook handler (raw body needed — registered before json parser wraps routes)
  // POST /api/bot/webhook — receives Telegram updates
  // GET  /api/bot/webhook — webhook verification
  app.all("/api/bot/webhook", handleBotWebhook);

  // Raw OpenAPI JSON spec — registered BEFORE registerRestApi so it is not caught by the auth middleware
  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });

  // REST API
  registerRestApi(app);

  // Swagger UI must be registered BEFORE Vite/static so it takes precedence over the catch-all "*" handler
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  }));

  // development mode uses Vite, production mode uses static files
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

  server.on("error", error => {
    console.error(`Failed to start server on port ${port}`, error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);