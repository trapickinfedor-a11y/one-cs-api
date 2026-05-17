/**
 * fingerprintRotator.ts — Browser fingerprint generation.
 *
 * Generates a fresh, randomized FingerprintProfile for each request.
 * Converts to Playwright-compatible context options.
 *
 * Reference: legacy_research/extracted/credit_score_bot/cs_module/fingerprint/rotator.py
 */

// ---------------------------------------------------------------------------
// Data pools for randomization
// ---------------------------------------------------------------------------

const SCREEN_RESOLUTIONS: Array<[number, number]> = [
  [1366, 768], [1920, 1080], [1440, 900], [1536, 864],
  [1280, 800], [1600, 900], [1280, 1024], [1024, 768],
  [1680, 1050], [1920, 1200], [2560, 1440], [1360, 768],
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Detroit",
  "America/Indiana/Indianapolis", "America/Boise",
  "America/Anchorage", "Pacific/Honolulu",
];

const LANGUAGES: string[][] = [
  ["en-US", "en"],
  ["en-US", "en", "es"],
  ["en-US", "en-GB", "en"],
  ["en-US"],
];

const PLATFORMS = ["Win32", "Win32", "Win32", "MacIntel", "Linux x86_64"];

const CPU_CORES = [2, 4, 4, 4, 6, 8, 8, 12, 16];

const DEVICE_MEMORY = [2, 4, 4, 8, 8, 16];

const WEBGL_VENDORS: Array<[string, string]> = [
  [
    "Google Inc. (NVIDIA)",
    "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ],
  [
    "Google Inc. (Intel)",
    "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ],
  [
    "Google Inc. (AMD)",
    "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ],
  [
    "Google Inc. (NVIDIA)",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ],
  ["Intel Inc.", "Intel Iris OpenGL Engine"],
  ["Apple Inc.", "Apple GPU"],
];

const FF_VERSIONS = [
  "115.0", "116.0", "117.0", "118.0", "119.0",
  "120.0", "121.0", "122.0", "123.0",
];

const WIN_VERSIONS = [
  "Windows NT 10.0; Win64; x64",
  "Windows NT 10.0; WOW64",
  "Windows NT 6.1; Win64; x64",
];

const MAC_VERSIONS = [
  "Macintosh; Intel Mac OS X 10.15",
  "Macintosh; Intel Mac OS X 11.0",
  "Macintosh; Intel Mac OS X 12.0",
  "Macintosh; Intel Mac OS X 13.0",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FingerprintProfile {
  /** Full User-Agent string */
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  languages: string[];
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  webglVendor: string;
  webglRenderer: string;
  canvasNoiseSeed: number;
  audioNoiseSeed: number;
  doNotTrack: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildFirefoxUserAgent(platform: string, ffVersion: string): string {
  let osStr: string;
  if (platform === "MacIntel") {
    osStr = pick(MAC_VERSIONS);
  } else if (platform === "Linux x86_64") {
    osStr = "X11; Linux x86_64";
  } else {
    osStr = pick(WIN_VERSIONS);
  }
  return `Mozilla/5.0 (${osStr}; rv:${ffVersion}) Gecko/20100101 Firefox/${ffVersion}`;
}

// ---------------------------------------------------------------------------
// Rotator
// ---------------------------------------------------------------------------

export class FingerprintRotator {
  /**
   * Generate a fresh, randomized FingerprintProfile.
   * Call `.generate()` to get a new profile for each browser request.
   */
  generate(): FingerprintProfile {
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
      canvasNoiseSeed: randInt(1, 999_999),
      audioNoiseSeed: randInt(1, 999_999),
      // Mostly no DNT (2/3 chance of null)
      doNotTrack: Math.random() < 0.33 ? "1" : null,
    };
  }

  /**
   * Convert a FingerprintProfile to Playwright BrowserContext options.
   * Pass these to `browser.newContext(...)`.
   */
  toContextOptions(profile: FingerprintProfile): Record<string, unknown> {
    return {
      userAgent: profile.userAgent,
      viewport: {
        width: profile.screenWidth,
        height: profile.screenHeight,
      },
      locale: profile.languages[0] ?? "en-US",
      timezoneId: profile.timezone,
      extraHTTPHeaders: {
        "Accept-Language": [...profile.languages, "q=0.9"].join(",").replace("en-US,q=0.9", "en-US,en;q=0.9"),
        "DNT": profile.doNotTrack ?? "1",
      },
      // deviceScaleFactor and isMobile left unset — default desktop
    };
  }

  /**
   * Return anti-detection launch arguments to pass to browser.newPage().
   * These are applied AFTER context creation and are passed as launch args
   * or via page.addInitScript.
   */
  getAntiDetectLaunchArgs(): string[] {
    return [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ];
  }

  /**
   * Build an object with all WebGL spoofing parameters.
   * Use with page.addInitScript to inject into the page.
   */
  buildWebGlSpoof(profile: FingerprintProfile): {
    vendor: string;
    renderer: string;
  } {
    return {
      vendor: profile.webglVendor,
      renderer: profile.webglRenderer,
    };
  }
}

/** Module-level singleton — prefer instantiating per-worker for isolation. */
export const defaultFingerprintRotator = new FingerprintRotator();

/**
 * Convert a FingerprintProfile to Playwright browser launch options.
 * Returns the extra options required to apply the fingerprint in a Playwright context.
 */
export function toPlaywrightOptions(profile: FingerprintProfile): {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
  extraHttpHeaders: Record<string, string>;
} {
  return {
    userAgent: profile.userAgent,
    viewport: {
      width: profile.screenWidth,
      height: profile.screenHeight,
    },
    locale: profile.languages[0] ?? "en-US",
    timezoneId: profile.timezone,
    extraHttpHeaders: {
      "Accept-Language": [...profile.languages, "q=0.9"].join(",").replace("en-US,q=0.9", "en-US,en;q=0.9"),
      "DNT": profile.doNotTrack ?? "1",
    },
  };
}
