/**
 * Browser Pool
 *
 * Manages a pool of Playwright browser instances with:
 * - Fingerprint application per browser context
 * - Proxy support (Evomi HTTP CONNECT format)
 * - Anti-detection launch arguments
 * - Automatic resource cleanup
 */

import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import { ENV } from "../_core/env.js";
import type { ProxyLease } from "../_core/proxy.js";
import type { FingerprintProfile } from "./fingerprintRotator.js";
import { buildThreatMetrixNoiseScript } from "./humanBehavior.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrowserPoolConfig = {
  /** Max concurrent browser instances in the pool */
  maxSize?: number;
  /** Headless mode (default: true for production) */
  headless?: boolean;
  /** Default timeout for page operations (ms) */
  timeoutMs?: number;
  /** Proxy lease to use (uses ENV defaults if not provided) */
  proxyLease?: ProxyLease;
};

export type AcquiredBrowser = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  proxyUrl: string | null;
  fingerprint: FingerprintProfile;
  released: boolean;
};

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

export class BrowserPool {
  private readonly _browsers: AcquiredBrowser[] = [];
  private readonly _maxSize: number;
  private readonly _headless: boolean;
  private readonly _timeoutMs: number;
  private _evomiHost: string;
  private _evomiPort: number;
  private _evomiUsername: string;
  private _evomiPassword: string;

  constructor(config: BrowserPoolConfig = {}) {
    this._maxSize = config.maxSize ?? 3;
    this._headless = config.headless ?? true;
    this._timeoutMs = config.timeoutMs ?? 60_000;

    // Load Evomi credentials from ENV
    this._evomiHost = ENV.evomiUsername ? "core-residential.evomi.com" : "";
    this._evomiPort = 1000;
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
  async acquire(
    fingerprint: FingerprintProfile,
    proxyUrl?: string | null,
    proxyCountry?: string,
  ): Promise<AcquiredBrowser> {
    // Clean up released browsers first
    this._cleanup();

    // Try to reuse an existing released browser
    const cached = this._browsers.find(b => !b.released);
    if (cached) {
      cached.fingerprint = fingerprint;
      return cached;
    }

    // Check pool size limit
    if (this._browsers.length >= this._maxSize) {
      // Return the oldest
      const oldest = this._browsers[0];
      await this._closeBrowser(oldest);
    }

    // Build proxy URL
    const finalProxyUrl = proxyUrl ?? (await this._buildProxyUrl(proxyCountry));

    // Launch browser
    const acquired = await this._launchBrowser(fingerprint, finalProxyUrl);
    this._browsers.push(acquired);
    return acquired;
  }

  /**
   * Release a browser back to the pool (marks as available for reuse).
   * Does NOT close the browser — it stays in the pool.
   */
  release(acquired: AcquiredBrowser): void {
    acquired.released = true;
  }

  /**
   * Release a browser AND close it (removes from pool completely).
   */
  async forceClose(acquired: AcquiredBrowser): Promise<void> {
    const idx = this._browsers.indexOf(acquired);
    if (idx !== -1) this._browsers.splice(idx, 1);
    await this._closeBrowser(acquired);
  }

  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  get activeCount(): number {
    return this._browsers.filter(b => !b.released).length;
  }

  get totalCount(): number {
    return this._browsers.length;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async _buildProxyUrl(country?: string): Promise<string | null> {
    if (!this._evomiUsername || !this._evomiPassword) {
      return null;
    }

    const countrySuffix = country ? `_country-${country}` : "";
    return `http://${this._evomiUsername}:${this._evomiPassword}${countrySuffix}@${this._evomiHost}:${this._evomiPort}`;
  }

  private async _launchBrowser(
    fingerprint: FingerprintProfile,
    proxyUrl: string | null,
  ): Promise<AcquiredBrowser> {
    const args = [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ];

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this._headless,
      args,
      timeout: this._timeoutMs,
    };

    // Apply proxy via launch args (Chromium format: --proxy-server=host:port)
    if (proxyUrl) {
      // Parse proxy URL for Chromium arg format
      try {
        const url = new URL(proxyUrl);
        const proxyHost = url.hostname;
        const proxyPort = url.port || "80";
        launchOptions.args!.push(`--proxy-server=${proxyHost}:${proxyPort}`);
        // Pass auth via launch args (basic auth might need context-level)
        launchOptions.args!.push(`--proxy-auth=${url.username}:${url.password}`);
      } catch {
        // Fallback: use just host:port
        if (proxyUrl.includes("@")) {
          const afterAt = proxyUrl.split("@")[1] ?? "";
          launchOptions.args!.push(`--proxy-server=${afterAt}`);
        }
      }
    }

    const browser = await chromium.launch(launchOptions);

    // Create context with fingerprint
    const context = await browser.newContext({
      userAgent: fingerprint.userAgent,
      viewport: {
        width: fingerprint.screenWidth,
        height: fingerprint.screenHeight,
      },
      locale: fingerprint.languages[0] ?? "en-US",
      timezoneId: fingerprint.timezone,
      extraHTTPHeaders: {
        "Accept-Language": fingerprint.languages.join(", "),
        "DNT": fingerprint.doNotTrack ?? "1",
      },
    });

    // Inject anti-fingerprint noise via init script
    await context.addInitScript({ content: buildThreatMetrixNoiseScript() });

    const page = await context.newPage();

    return {
      browser,
      context,
      page,
      proxyUrl,
      fingerprint,
      released: false,
    };
  }

  private _cleanup(): void {
    for (let i = this._browsers.length - 1; i >= 0; i--) {
      if (this._browsers[i].released) {
        // Keep in pool for reuse for now
      }
    }
  }

  private async _closeBrowser(acquired: AcquiredBrowser): Promise<void> {
    try {
      await acquired.context.close();
    } catch { /* ignore */ }
    try {
      await acquired.browser.close();
    } catch { /* ignore */ }
  }

  /**
   * Shutdown the entire pool.
   */
  async shutdown(): Promise<void> {
    for (const b of [...this._browsers]) {
      await this._closeBrowser(b);
    }
    this._browsers.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Global singleton pool (lazy init)
// ---------------------------------------------------------------------------

let _globalPool: BrowserPool | null = null;

export function getBrowserPool(config?: BrowserPoolConfig): BrowserPool {
  if (!_globalPool || config) {
    if (_globalPool) {
      _globalPool.shutdown().catch(() => {});
    }
    _globalPool = new BrowserPool(config);
  }
  return _globalPool;
}

export async function shutdownBrowserPool(): Promise<void> {
  if (_globalPool) {
    await _globalPool.shutdown();
    _globalPool = null;
  }
}