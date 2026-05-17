/**
 * Tests for worker polling endpoints
 */

import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerRestApi } from "./restApi";
import { createSingleJob } from "./platformService";
import { resetRuntimeStore } from "./runtimeStore";

let server: ReturnType<express.Express["listen"]> | null = null;
let baseUrl = "";

describe("Worker Polling Endpoints", () => {
  beforeAll(async () => {
    // Use PRIVATE_API_KEY for testing
    process.env.PRIVATE_API_KEY = "test_admin_key_for_polling_12345";

    const app = express();
    app.use(express.json());
    registerRestApi(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server?.address();
        if (!address || typeof address === "string") throw new Error("Failed to bind");
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    resetRuntimeStore();
  });

  afterAll(async () => {
    resetRuntimeStore();
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  });

  describe("GET /api/v1/queue/next", () => {
    it("returns null when no jobs in queue", async () => {
      const response = await fetch(`${baseUrl}/api/v1/queue/next`, {
        headers: { Authorization: "Bearer test_admin_key_for_polling_12345" },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.job).toBeNull();
    });

    it("returns queue status with message when empty", async () => {
      const response = await fetch(`${baseUrl}/api/v1/queue/next`, {
        headers: { Authorization: "Bearer test_admin_key_for_polling_12345" },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.job).toBeNull();
      expect(data.data.message).toBe("No jobs in queue");
    });
  });

  describe("PUT /api/v1/jobs/:publicId/start", () => {
    it("marks job as running", async () => {
      // Create a queued job
      const result = await createSingleJob({
        requestMode: "single",
        queueName: "default",
        payload: { creditScore: 720 },
        safeTestMode: false,
      }, { source: "api" });

      const publicId = result.data.job.publicId;

      const response = await fetch(`${baseUrl}/api/v1/jobs/${publicId}/start`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer test_admin_key_for_polling_12345",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workerId: "worker-test-1" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.status).toBe("running");
    });

    it("returns 404 for non-existent job", async () => {
      const response = await fetch(`${baseUrl}/api/v1/jobs/non_existent_job/start`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer test_admin_key_for_polling_12345",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/v1/jobs/:publicId/complete", () => {
    it("marks job as succeeded with result", async () => {
      const result = await createSingleJob({
        requestMode: "single",
        queueName: "default",
        payload: { creditScore: 750 },
        safeTestMode: false,
      }, { source: "api" });

      const publicId = result.data.job.publicId;

      const response = await fetch(`${baseUrl}/api/v1/jobs/${publicId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer test_admin_key_for_polling_12345",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          result: { creditScore: 750, dataQualityScore: 8.5 },
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.status).toBe("succeeded");
    });

    it("marks job as failed with error", async () => {
      const result = await createSingleJob({
        requestMode: "single",
        queueName: "default",
        payload: { creditScore: 650 },
        safeTestMode: false,
      }, { source: "api" });

      const publicId = result.data.job.publicId;

      const response = await fetch(`${baseUrl}/api/v1/jobs/${publicId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer test_admin_key_for_polling_12345",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          error: "Proxy connection timeout",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.status).toBe("failed");
    });
  });
});
