import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { extractBearerToken, verifyToken } from "./auth";
import { ENV } from "./env";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: db.AdminRow | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: db.AdminRow | null = null;

  try {
    const req = opts.req;
    const authHeader = req.headers?.authorization as string | undefined;
    const token = extractBearerToken(authHeader);

    if (token && ENV.jwtSecret) {
      const payload = await verifyToken(token, ENV.jwtSecret);
      if (payload && payload.role === "admin") {
        user = await db.getAdminByUsername(payload.username);
      }
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}