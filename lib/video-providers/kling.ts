import "server-only";
/**
 * Kling AI Image-to-Video provider — via fal.ai
 *
 * Uses fal.ai queue API to submit and poll Kling video generation tasks.
 * This replaces the direct kie.ai proxy with a unified fal.ai integration
 * (same provider as our image generation).
 *
 * Workflow:
 *   1. fal.queue.submit() → returns requestId (our taskId)
 *   2. fal.queue.status() → poll until COMPLETED or failed
 *   3. fal.queue.result() → fetch the video URL
 *
 * Mock mode activates when FAL_KEY is absent OR when MOCK_VIDEO=true.
 * Set MOCK_VIDEO=true in .env.local to test the UI flow without spending
 * fal.ai credits, even when FAL_KEY is present for image generation.
 */

import { fal } from "@fal-ai/client";
import { VIDEO_MODEL as MODEL } from "@/constants";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Mock when no FAL_KEY configured, or when explicitly requested via env flag
const USE_MOCK =
  !process.env.FAL_KEY ||
  process.env.FAL_KEY.trim() === "" ||
  process.env.MOCK_VIDEO === "true";

// Ensure fal is configured (credentials also set in lib/ai/image.ts,
// but we set it here too for safety)
if (!USE_MOCK) {
  fal.config({ credentials: process.env.FAL_KEY });
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VideoGenerationInput {
  /** Public URL of the source image (JPEG/PNG/WebP, min 300 px per side) */
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
// Mock implementation
// ---------------------------------------------------------------------------

const mockPollCounts: Record<string, number> = {};

function mockCreateTask(input: VideoGenerationInput): VideoGenerationResult {
  const taskId = `mock_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.warn(
    `[kling-fal] MOCK mode — fake taskId=${taskId} for prompt="${input.prompt.slice(0, 40)}..."`
  );
  return { taskId, status: "pending" };
}

function mockPollTask(taskId: string): VideoGenerationResult {
  const count = (mockPollCounts[taskId] ?? 0) + 1;
  mockPollCounts[taskId] = count;

  if (count < 3) {
    return { taskId, status: "processing" };
  }

  return {
    taskId,
    status: "completed",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    generationTimeMs: count * 1000,
  };
}

// ---------------------------------------------------------------------------
// Real implementation via fal.ai queue
// ---------------------------------------------------------------------------

async function realCreateTask(
  input: VideoGenerationInput
): Promise<VideoGenerationResult> {
  const startMs = Date.now();

  const { request_id } = await fal.queue.submit(MODEL, {
    input: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      duration: String(input.duration) as "5" | "10",
    },
  });

  return {
    taskId: request_id,
    status: "pending",
    generationTimeMs: Date.now() - startMs,
  };
}

async function realPollTask(taskId: string): Promise<VideoGenerationResult> {
  const startMs = Date.now();

  const statusResponse = await fal.queue.status(MODEL, {
    requestId: taskId,
    logs: false,
  });

  // fal.ai can also return "FAILED" at runtime even though it's not in the TS types
  const falStatus = statusResponse.status as string;

  console.log(`[kling-fal] poll taskId=${taskId} falStatus=${falStatus}`);

  if (falStatus === "COMPLETED") {
    // Fetch the actual result
    const result = await fal.queue.result(MODEL, {
      requestId: taskId,
    });

    const data = result.data as { video?: { url?: string } };
    const videoUrl = data?.video?.url;

    console.log(`[kling-fal] completed taskId=${taskId} videoUrl=${videoUrl}`);

    return {
      taskId,
      status: videoUrl ? "completed" : "failed",
      videoUrl,
      error: videoUrl ? undefined : "No video URL in response",
      generationTimeMs: Date.now() - startMs,
    };
  }

  // Handle explicit failure from fal.ai
  if (falStatus === "FAILED" || falStatus === "ERROR") {
    console.error(`[kling-fal] task failed taskId=${taskId} status=${falStatus}`);
    return {
      taskId,
      status: "failed",
      error: `fal.ai reported status: ${falStatus}`,
      generationTimeMs: Date.now() - startMs,
    };
  }

  const statusMap: Record<string, VideoGenerationResult["status"]> = {
    IN_QUEUE: "pending",
    IN_PROGRESS: "processing",
  };

  return {
    taskId,
    status: statusMap[falStatus] ?? "processing",
    generationTimeMs: Date.now() - startMs,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createVideoTask(
  input: VideoGenerationInput
): Promise<VideoGenerationResult> {
  if (USE_MOCK) return mockCreateTask(input);
  try {
    return await realCreateTask(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kling-fal] createVideoTask failed:", msg);
    throw err;
  }
}

export async function pollVideoTask(
  taskId: string
): Promise<VideoGenerationResult> {
  if (USE_MOCK) return mockPollTask(taskId);
  try {
    return await realPollTask(taskId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[kling-fal] pollVideoTask failed:", msg);
    throw err;
  }
}
