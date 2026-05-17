import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export interface Admin {
  id: number;
  username: string;
  passwordHash: string;
  role: "admin";
}

export interface TokenPayload {
  username: string;
  role: string;
}

/**
 * Hash a password using bcrypt with cost factor 12.
 */
export async function createPasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Alias for createPasswordHash */
export const hashPassword = createPasswordHash;

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token (HS256), valid for 1 year.
 */
export async function createToken(
  username: string,
  role: string,
  secret: string,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  const expirationSeconds = now + ONE_YEAR_SECONDS;

  return new SignJWT({ username, role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

/**
 * Verify a JWT token and return the payload, or null if invalid.
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    const username = payload["username"] as string;
    const role = payload["role"] as string;

    if (typeof username !== "string" || username.length === 0) {
      return null;
    }

    return { username, role: role ?? "admin" };
  } catch {
    return null;
  }
}

/**
 * Extract the bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7) || null;
}