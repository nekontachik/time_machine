/**
 * Kling AI Image-to-Video provider
 *
 * Official API: https://docs.kie.ai/market/kling/image-to-video
 * Auth: Bearer token — set KLING_API_KEY in environment
 *
 * Workflow:
 *   1. POST /api/v1/jobs/createTask  → returns { data: { taskId } }
 *   2. GET  /api/v1/jobs/recordInfo?taskId=:taskId → poll until status is "completed" or "failed"
 *
 * Typical latency: 30–120 seconds for a 5-second clip.
 *
 * NOTE: The MOCK flag below controls whether real API calls are made.
 * Set USE_MOCK = false and fill in KLING_API_KEY to go live.
 */

import Redis from "ioredis";

const KLING_BASE_URL = "https://api.kie.ai/api/v1";

// Automatically mock when no API key is configured
const USE_MOCK =
  !process.env.KLING_API_KEY || process.env.KLING_API_KEY.trim() === "";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VideoGenerationInput {
  /** Public URL of the Flux-generated image (JPEG/PNG/WebP, max 10 MB, min 300 px per side) */
  imageUrl: string;
  /** Text description of the desired motion — keep under 1 000 characters */
  prompt: string;
  /** Clip length in seconds */
  duration: 5 | 10;
}

export interface VideoGenerationResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
  generationTimeMs?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authHeader(): { Authorization: string } {
  const key = process.env.KLING_API_KEY ?? "";
  // KIE.ai third-party proxy uses raw API key as Bearer token.
  // If switching to official Kuaishou endpoint, replace with JWT generation.
  return { Authorization: `Bearer ${key}` };
}

// ---------------------------------------------------------------------------
// Redis client for mock poll counter
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
let _redisUnavailable = false;

function getMockRedis(): Redis | null {
  if (_redisUnavailable) return null;
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    _redisUnavailable = true;
    return null;
  }

  _redis = new Redis(url, {
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  _redis.on("error", () => {
    _redisUnavailable = true;
    _redis = null;
  });
  return _redis;
}

/**
 * Increment and return the poll count for a mock taskId.
 * Uses Redis key `mock-polls:{taskId}` with a 1-hour TTL.
 * Falls back to in-memory counter when Redis is unavailable.
 */
const inMemoryPollCount: Record<string, number> = {};

async function incrementMockPollCount(taskId: string): Promise<number> {
  const r = getMockRedis();
  if (r) {
    try {
      const key = `mock-polls:${taskId}`;
      const count = await r.incr(key);
      if (count === 1) {
        await r.expire(key, 3600); // TTL 1 hour
      }
      return count;
    } catch {
      // Fall through to in-memory
    }
  }
  // In-memory fallback
  const count = (inMemoryPollCount[taskId] ?? 0) + 1;
  inMemoryPollCount[taskId] = count;
  return count;
}

// ---------------------------------------------------------------------------
// Mock implementation (used when USE_MOCK is true)
// ---------------------------------------------------------------------------

function mockCreateTask(input: VideoGenerationInput): VideoGenerationResult {
  const taskId = `mock_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.warn(
    `[kling] MOCK mode — returning fake taskId=${taskId} for prompt="${input.prompt.slice(0, 40)}..."`
  );
  return { taskId, status: "pending" };
}

async function mockPollTask(taskId: string): Promise<VideoGenerationResult> {
  const count = await incrementMockPollCount(taskId);

  if (count < 3) {
    return { taskId, status: "processing" };
  }

  // After exactly 3 polls return a placeholder completed video
  return {
    taskId,
    status: "completed",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", // placeholder
    generationTimeMs: count * 1000, // simulate elapsed time
  };
}

// ---------------------------------------------------------------------------
// Real implementation
// ---------------------------------------------------------------------------

async function realCreateTask(
  input: VideoGenerationInput
): Promise<VideoGenerationResult> {
  const startMs = Date.now();

  // TODO: verify min image dimensions (≥ 300 px per side) before upload
  const res = await fetch(`${KLING_BASE_URL}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({
      // TODO: update model string when upgrading past kling-2.6
      model: "kling-2.6/image-to-video",
      input: {
        prompt: input.prompt,
        image_urls: [input.imageUrl],
        sound: false,
        duration: String(input.duration),
      },
      // TODO: set callBackUrl to your webhook endpoint to avoid polling in prod
      // callBackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/video/webhook`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kling createTask HTTP ${res.status}: ${text}`);
  }

  // Expected: { code: 200, msg: "success", data: { taskId: "task_kling-2.6_..." } }
  const json = (await res.json()) as {
    code: number;
    msg: string;
    data?: { taskId?: string };
  };

  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`Kling createTask error: ${json.msg ?? "unknown"}`);
  }

  return {
    taskId: json.data.taskId,
    status: "pending",
    generationTimeMs: Date.now() - startMs,
  };
}

async function realPollTask(taskId: string): Promise<VideoGenerationResult> {
  const startMs = Date.now();

  const url = `${KLING_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeader(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Kling recordInfo HTTP ${res.status}: ${text}`);
  }

  // Actual response shape:
  // { code: 200, data: { taskId, model, state, resultJson, failCode, failMsg, costTime } }
  // state: "waiting" | "queuing" | "generating" | "success" | "fail"
  // resultJson: JSON string containing { resultUrls: string[] }
  const json = (await res.json()) as {
    code: number;
    data?: {
      taskId?: string;
      state?: string;
      resultJson?: string;
      failMsg?: string;
    };
  };

  if (json.code !== 200 || !json.data) {
    throw new Error(`Kling recordInfo error: code=${json.code}`);
  }

  const rawState = json.data.state ?? "";

  const statusMap: Record<string, VideoGenerationResult["status"]> = {
    waiting: "pending",
    queuing: "pending",
    generating: "processing",
    success: "completed",
    fail: "failed",
  };
  const status: VideoGenerationResult["status"] =
    statusMap[rawState] ?? "processing";

  let videoUrl: string | undefined;
  if (status === "completed" && json.data.resultJson) {
    try {
      const parsed = JSON.parse(json.data.resultJson) as { resultUrls?: string[] };
      videoUrl = parsed.resultUrls?.[0];
    } catch {
      // resultJson unparseable — leave videoUrl undefined
    }
  }

  return {
    taskId,
    status,
    videoUrl,
    error: status === "failed" ? (json.data.failMsg ?? "Generation failed") : undefined,
    generationTimeMs: Date.now() - startMs,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit an image-to-video task to Kling AI.
 * Accepts { imageUrl, prompt, duration: 5|10 }.
 * Returns immediately with a taskId — the video is not ready yet.
 */
export async function createVideoTask(
  input: VideoGenerationInput
): Promise<VideoGenerationResult> {
  if (USE_MOCK) return mockCreateTask(input);
  try {
    return await realCreateTask(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kling] createVideoTask failed:", msg);
    throw err;
  }
}

/**
 * Poll Kling AI for the current status of a previously submitted task.
 * Accepts a taskId string.
 * Returns { taskId, status, videoUrl?, error?, generationTimeMs? }.
 * Call repeatedly (e.g. every 5 s) until status is "completed" or "failed".
 */
export async function pollVideoTask(
  taskId: string
): Promise<VideoGenerationResult> {
  if (USE_MOCK) {
    try {
      return await mockPollTask(taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[kling] mockPollTask failed:", msg);
      throw err;
    }
  }
  try {
    return await realPollTask(taskId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kling] pollVideoTask failed:", msg);
    throw err;
  }
}
