import { NextRequest, NextResponse } from "next/server";
import { createVideoTask } from "@/lib/video-providers/kling";
import { getClientIp } from "@/lib/rateLimit";
import { isPremium } from "@/lib/premium";
import type { VideoGenerationInput } from "@/lib/video-providers/kling";

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface VideoCreateRequest {
  imageUrl: string;
  prompt: string;
  duration?: 5 | 10;
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

  const { imageUrl, prompt, duration = 5 } = body;

  if (!imageUrl || !prompt) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "imageUrl and prompt are required" },
      { status: 400 }
    );
  }

  if (duration !== 5 && duration !== 10) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "duration must be 5 or 10" },
      { status: 400 }
    );
  }

  const input: VideoGenerationInput = { imageUrl, prompt, duration };

  try {
    const result = await createVideoTask(input);
    return NextResponse.json({
      ...result,
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
