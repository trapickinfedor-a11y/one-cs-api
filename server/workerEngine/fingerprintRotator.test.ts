import { describe, expect, it } from "vitest";
import { FingerprintRotator, defaultFingerprintRotator, toPlaywrightOptions } from "./fingerprintRotator";

describe("FingerprintRotator", () => {
  describe("generate() creates valid FingerprintProfile", () => {
    it("returns a profile with all required fields defined", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();

      expect(typeof profile.userAgent).toBe("string");
      expect(profile.userAgent.length).toBeGreaterThan(0);
      expect(typeof profile.screenWidth).toBe("number");
      expect(typeof profile.screenHeight).toBe("number");
      expect(typeof profile.timezone).toBe("string");
      expect(Array.isArray(profile.languages)).toBe(true);
      expect(profile.languages.length).toBeGreaterThan(0);
      expect(typeof profile.platform).toBe("string");
      expect(typeof profile.hardwareConcurrency).toBe("number");
      expect(typeof profile.deviceMemory).toBe("number");
      expect(typeof profile.webglVendor).toBe("string");
      expect(typeof profile.webglRenderer).toBe("string");
      expect(typeof profile.canvasNoiseSeed).toBe("number");
      expect(typeof profile.audioNoiseSeed).toBe("number");
    });

    it("screen width and height are within expected ranges", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(profile.screenWidth).toBeGreaterThanOrEqual(800);
        expect(profile.screenWidth).toBeLessThanOrEqual(3840);
        expect(profile.screenHeight).toBeGreaterThanOrEqual(600);
        expect(profile.screenHeight).toBeLessThanOrEqual(2160);
      }
    });

    it("timezone is one of the known US timezones", () => {
      const rotator = new FingerprintRotator();
      const knownTimezones = [
        "America/New_York", "America/Chicago", "America/Denver",
        "America/Los_Angeles", "America/Phoenix", "America/Detroit",
        "America/Indiana/Indianapolis", "America/Boise",
        "America/Anchorage", "Pacific/Honolulu",
      ];

      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(knownTimezones).toContain(profile.timezone);
      }
    });

    it("languages array contains at least 'en-US'", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(profile.languages[0]).toBe("en-US");
      }
    });

    it("platform is one of the valid values", () => {
      const rotator = new FingerprintRotator();
      const validPlatforms = ["Win32", "Win32", "Win32", "MacIntel", "Linux x86_64"];

      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(validPlatforms).toContain(profile.platform);
      }
    });

    it("hardwareConcurrency is a positive integer", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(Number.isInteger(profile.hardwareConcurrency)).toBe(true);
        expect(profile.hardwareConcurrency).toBeGreaterThan(0);
        expect(profile.hardwareConcurrency).toBeLessThanOrEqual(32);
      }
    });

    it("deviceMemory is a positive integer within the configured pool", () => {
      const rotator = new FingerprintRotator();
      const validMemories = [2, 4, 4, 8, 8, 16];

      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(validMemories).toContain(profile.deviceMemory);
      }
    });

    it("canvasNoiseSeed and audioNoiseSeed are integers in 1-999999 range", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(profile.canvasNoiseSeed).toBeGreaterThanOrEqual(1);
        expect(profile.canvasNoiseSeed).toBeLessThanOrEqual(999_999);
        expect(profile.audioNoiseSeed).toBeGreaterThanOrEqual(1);
        expect(profile.audioNoiseSeed).toBeLessThanOrEqual(999_999);
      }
    });

    it("doNotTrack is either '1' or null (not a random string)", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 50; i++) {
        const profile = rotator.generate();
        expect(profile.doNotTrack === "1" || profile.doNotTrack === null).toBe(true);
      }
    });

    it("userAgent is a valid Firefox Mozilla format string", () => {
      const rotator = new FingerprintRotator();
      for (let i = 0; i < 20; i++) {
        const profile = rotator.generate();
        expect(profile.userAgent).toMatch(/^Mozilla\/5\.0 \(/);
        expect(profile.userAgent).toMatch(/Firefox\/\d+\.\d+/);
      }
    });
  });

  describe("Two calls produce different profiles (randomization)", () => {
    it("generates different screen dimensions across multiple calls", () => {
      const rotator = new FingerprintRotator();
      const results = new Set<string>();

      for (let i = 0; i < 30; i++) {
        const profile = rotator.generate();
        results.add(`${profile.screenWidth}x${profile.screenHeight}`);
      }

      // With 12 possible resolutions, 30 tries should yield at least 2 different
      expect(results.size).toBeGreaterThanOrEqual(2);
    });

    it("generates different canvasNoiseSeed values across multiple calls", () => {
      const rotator = new FingerprintRotator();
      const seeds = new Set<number>();

      for (let i = 0; i < 30; i++) {
        const profile = rotator.generate();
        seeds.add(profile.canvasNoiseSeed);
      }

      expect(seeds.size).toBeGreaterThanOrEqual(2);
    });

    it("generates different timezones across multiple calls", () => {
      const rotator = new FingerprintRotator();
      const tzs = new Set<string>();

      for (let i = 0; i < 30; i++) {
        const profile = rotator.generate();
        tzs.add(profile.timezone);
      }

      expect(tzs.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("toPlaywrightOptions() returns valid Playwright browser launch options", () => {
    it("returns all required Playwright context fields", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const options = toPlaywrightOptions(profile);

      expect(typeof options.userAgent).toBe("string");
      expect(options.viewport).toBeDefined();
      expect(typeof options.viewport.width).toBe("number");
      expect(typeof options.viewport.height).toBe("number");
      expect(typeof options.locale).toBe("string");
      expect(typeof options.timezoneId).toBe("string");
      expect(typeof options.extraHttpHeaders).toBe("object");
      expect("Accept-Language" in options.extraHttpHeaders).toBe(true);
      expect("DNT" in options.extraHttpHeaders).toBe(true);
    });

    it("locale is taken from the first language in the profile", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const options = toPlaywrightOptions(profile);

      expect(options.locale).toBe(profile.languages[0]);
    });

    it("viewport dimensions match the profile", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const options = toPlaywrightOptions(profile);

      expect(options.viewport.width).toBe(profile.screenWidth);
      expect(options.viewport.height).toBe(profile.screenHeight);
    });

    it("Accept-Language header includes profile languages", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const options = toPlaywrightOptions(profile);
      const acceptLang = options.extraHttpHeaders["Accept-Language"];

      // The first language should appear in the header
      expect(acceptLang).toContain(profile.languages[0]);
    });

    it("DNT header is '1' when doNotTrack is null (defaults to '1')", () => {
      // Force doNotTrack to null via a profile constructed manually
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      // Override doNotTrack to null to test the default
      const nullDntProfile = { ...profile, doNotTrack: null };
      const options = toPlaywrightOptions(nullDntProfile);

      expect(options.extraHttpHeaders["DNT"]).toBe("1");
    });
  });

  describe("toContextOptions() on the rotator instance", () => {
    it("returns a valid context options object", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const ctxOptions = rotator.toContextOptions(profile);

      expect(typeof ctxOptions).toBe("object");
      expect(ctxOptions.userAgent).toBe(profile.userAgent);
      expect((ctxOptions.viewport as { width: number }).width).toBe(profile.screenWidth);
    });
  });

  describe("getAntiDetectLaunchArgs() returns browser launch args", () => {
    it("returns an array of non-empty launch arguments", () => {
      const rotator = new FingerprintRotator();
      const args = rotator.getAntiDetectLaunchArgs();

      expect(Array.isArray(args)).toBe(true);
      expect(args.length).toBeGreaterThan(0);
      expect(args.every(arg => typeof arg === "string" && arg.startsWith("--"))).toBe(true);
      // AutomationControlled disable is present
      expect(args.some(arg => arg.includes("AutomationControlled"))).toBe(true);
    });
  });

  describe("buildWebGlSpoof() returns WebGL spoofing params", () => {
    it("returns vendor and renderer from the profile", () => {
      const rotator = new FingerprintRotator();
      const profile = rotator.generate();
      const spoof = rotator.buildWebGlSpoof(profile);

      expect(spoof.vendor).toBe(profile.webglVendor);
      expect(spoof.renderer).toBe(profile.webglRenderer);
      expect(spoof.vendor.length).toBeGreaterThan(0);
      expect(spoof.renderer.length).toBeGreaterThan(0);
    });
  });

  describe("module-level singleton", () => {
    it("defaultFingerprintRotator is an instance of FingerprintRotator", () => {
      expect(defaultFingerprintRotator).toBeInstanceOf(FingerprintRotator);
    });

    it("singleton generate() produces valid profiles", () => {
      const profile = defaultFingerprintRotator.generate();
      expect(typeof profile.userAgent).toBe("string");
      expect(profile.screenWidth).toBeGreaterThan(0);
    });
  });
});