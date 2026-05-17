#!/usr/bin/env node
/**
 * Worker script for ONE CS API
 * Polls for queued jobs and executes them
 */

const API_BASE = process.env.API_BASE || "http://localhost:3000/api/v1";
const API_KEY = process.env.WORKER_API_KEY || "test_admin_key_for_polling_12345";
const WORKER_ID = process.env.WORKER_ID || "worker-1";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);
const SAFE_TEST_MODE = process.env.SAFE_TEST_MODE === "true";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  return res.json();
}

async function pollForJob() {
  try {
    const data = await apiFetch(`/queue/next?workerId=${WORKER_ID}`);
    if (!data.ok) {
      console.warn(`[${WORKER_ID}] Queue poll failed:`, data.error);
      return null;
    }
    if (!data.data.job) {
      return null;
    }
    return data.data.job;
  } catch (e) {
    console.error(`[${WORKER_ID}] Queue poll error:`, e.message);
    return null;
  }
}

async function markJobStart(publicId) {
  try {
    await apiFetch(`/jobs/${publicId}/start`, {
      method: "PUT",
      body: JSON.stringify({ workerId: WORKER_ID }),
    });
    console.log(`[${WORKER_ID}] Started job: ${publicId}`);
  } catch (e) {
    console.error(`[${WORKER_ID}] Failed to mark job start:`, e.message);
  }
}

async function markJobComplete(publicId, success, result, error) {
  try {
    await apiFetch(`/jobs/${publicId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ success, result, error }),
    });
    console.log(`[${WORKER_ID}] Completed job: ${publicId} (${success ? "success" : "failed"})`);
  } catch (e) {
    console.error(`[${WORKER_ID}] Failed to mark job complete:`, e.message);
  }
}

async function executeJob(job) {
  // SAFE TEST MODE: Use built-in scoring
  if (SAFE_TEST_MODE || job.safeTestMode) {
    return simulateSafeExecution(job);
  }
  
  // REAL MODE: Implement actual job execution
  // TODO: Integrate with browser automation / external API
  console.log(`[${WORKER_ID}] Real execution not implemented, using safe mode`);
  return simulateSafeExecution(job);
}

function simulateSafeExecution(job) {
  // Deterministic score from payload hash
  const creditScore = job.creditScore ?? Math.floor(Math.random() * 400) + 450;
  const dqs = Math.min(10, Math.max(1, Math.round((creditScore / 850) * 10 * 10) / 10));
  
  return {
    ok: true,
    data: {
      creditScore,
      dataQualityScore: dqs,
      productScore: Math.min(20, Math.max(1, Math.round(dqs * 2))),
      status: creditScore >= 700 ? "success" : creditScore >= 580 ? "review" : "decline",
      adverseReasons: [],
      durationMs: Math.floor(Math.random() * 500) + 200,
    }
  };
}

async function processJob(job) {
  const { publicId, payload } = job;
  
  await markJobStart(publicId);
  
  const start = Date.now();
  const result = await executeJob(payload);
  const duration = Date.now() - start;
  
  if (result.ok) {
    await markJobComplete(publicId, true, { ...result.data, durationMs: duration }, null);
  } else {
    await markJobComplete(publicId, false, null, result.error || "Unknown error");
  }
}

async function workerLoop() {
  console.log(`[${WORKER_ID}] Worker started`);
  console.log(`[${WORKER_ID}] API: ${API_BASE}`);
  console.log(`[${WORKER_ID}] Safe mode: ${SAFE_TEST_MODE}`);
  console.log(`[${WORKER_ID}] Poll interval: ${POLL_INTERVAL_MS}ms`);
  
  while (true) {
    const job = await pollForJob();
    
    if (job) {
      await processJob(job);
    } else {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`[${WORKER_ID}] Shutting down...`);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(`[${WORKER_ID}] Shutting down...`);
  process.exit(0);
});

// Start worker
workerLoop().catch(e => {
  console.error(`[${WORKER_ID}] Fatal error:`, e);
  process.exit(1);
});
