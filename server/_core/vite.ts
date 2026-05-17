import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

function resolveClientRoot(): string {
  // In development, client/ is at project root (csbot_admin_system/client/)
  // In production, the dist/public/ path is resolved by serveStatic
  const devPath = path.resolve(process.cwd(), "client");
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  // Fallback for cases where cwd differs
  return path.resolve(import.meta.dirname, "..", "..", "client");
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientRoot = resolveClientRoot();
      const clientTemplate = path.resolve(clientRoot, "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Try dist/public first (production build), then fall back to client/ (dev)
  const distPublic = path.resolve(import.meta.dirname, "..", "..", "dist", "public");
  const devClient = path.resolve(process.cwd(), "client");
  const distPath = fs.existsSync(distPublic) ? distPublic : devClient;

  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the static directory: ${distPath}`);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).json({ error: "Client build not found", path: distPath });
    }
  });
}
