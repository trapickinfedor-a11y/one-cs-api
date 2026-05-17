import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

interface LegacySecrets {
  BOT_TOKEN: string;
  PRIVATE_API_KEY: string;
  ADMIN_PASSWORD: string;
  WORKER_COUNT: string;
  ADMIN_USER_IDS: string;
  WORKER_ROTATE_ON_SUCCESS: string;
  PRIVATE_API_PORT: string;
  CAPTCHA_SERVICE: string;
}

// Skip if secrets file doesn't exist
const secretsPath = resolve(import.meta.dirname, "../.secure/legacy_selected_secrets.json");
const hasSecrets = existsSync(secretsPath);

function loadLegacySecrets(): LegacySecrets {
  return JSON.parse(readFileSync(secretsPath, "utf-8")) as LegacySecrets;
}

(hasSecrets ? describe : describe.skip)("legacy secret migration", () => {
  it("loads migrated secrets from .secure/legacy_selected_secrets.json", () => {
    const secrets = loadLegacySecrets();

    expect(secrets.BOT_TOKEN).toBeTruthy();
    expect(secrets.BOT_TOKEN).toContain(":");
    expect(secrets.ADMIN_USER_IDS).toMatch(/^\d+(,\d+)*$/);
    expect(Number(secrets.WORKER_COUNT)).toBeGreaterThan(0);
    expect(Number(secrets.WORKER_ROTATE_ON_SUCCESS)).toBeGreaterThan(0);
    expect(secrets.PRIVATE_API_KEY?.length).toBeGreaterThan(10);
    expect(Number(secrets.PRIVATE_API_PORT)).toBe(8000);
    expect(secrets.ADMIN_PASSWORD?.length).toBeGreaterThan(8);
    expect(secrets.CAPTCHA_SERVICE).toBe("2captcha");
  });
});