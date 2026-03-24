import { NextRequest, NextResponse } from "next/server";
import { createVideoTask } from "@/lib/video-providers/kling";
import { buildMotionPrompt } from "@/lib/ai/video-prompt";
import { getClientIp } from "@/lib/infrastructure/rate-limit";
import { isPremium } from "@/lib/premium";
import type { VideoGenerationInput } from "@/lib/video-providers/kling";

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface VideoCreateRequest {
  imageUrl: string;
  duration?: 5 | 10;
  // Preferred: pass scenario context so the server builds a proper Kling prompt
  scenarioText?: string;
  eventName?: string;
  year?: number;
  // Legacy fallback: pre-built prompt from the client
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  const ip = getClientIp(req);

  // Premium gate
  const premium = await isPremium(ip);
  if (!premium) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "Premium feature required" },
      { status: 403 }
    );
  }

  // Parse body
  let body: VideoCreateRequest;
  try {
    body = (await req.json()) as VideoCreateRequest;
  } catch {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { imageUrl, duration = 5, scenarioText, eventName, year, prompt } = body;

  if (!imageUrl) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "imageUrl is required" },
      { status: 400 }
    );
  }

  if (duration !== 5 && duration !== 10) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "duration must be 5 or 10" },
      { status: 400 }
    );
  }

  // Build a Kling-optimised motion prompt server-side when scenario context
  // is provided; otherwise fall back to the legacy client-supplied prompt.
  let motionPrompt: string;
  if (scenarioText && year !== undefined) {
    motionPrompt = buildMotionPrompt(
      eventName ?? scenarioText.slice(0, 80),
      scenarioText,
      year
    );
  } else if (prompt) {
    motionPrompt = prompt;
  } else {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "Provide scenarioText+year or prompt" },
      { status: 400 }
    );
  }

  console.log("[video/create] motion prompt:", motionPrompt);

  const input: VideoGenerationInput = { imageUrl, prompt: motionPrompt, duration };

  try {
    const result = await createVideoTask(input);
    return NextResponse.json({
      ...result,
      motionPrompt, // return for debugging
      generationTimeMs: result.generationTimeMs ?? Date.now() - startMs,
    });
  } catch (err) {
    console.error("[video/create]", err);
    const msg = err instanceof Error ? err.message : "Video task creation failed";
    return NextResponse.json(
      { taskId: null, status: "failed", error: msg },
      { status: 500 }
    );
  }
}
