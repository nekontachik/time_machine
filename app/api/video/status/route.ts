import { NextRequest, NextResponse } from "next/server";
import { pollVideoTask } from "@/lib/video-providers/kling";
import { getClientIp } from "@/lib/infrastructure/rate-limit";
import { isPremium } from "@/lib/premium";

// ---------------------------------------------------------------------------
// Route handler — GET /api/video/status?taskId=<id>
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { taskId: null, status: "failed", error: "taskId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const result = await pollVideoTask(taskId);
    return NextResponse.json({
      ...result,
      generationTimeMs: result.generationTimeMs ?? Date.now() - startMs,
    });
  } catch (err) {
    console.error("[video/status]", err);
    const msg = err instanceof Error ? err.message : "Failed to query video task status";
    return NextResponse.json(
      { taskId, status: "failed", error: msg },
      { status: 500 }
    );
  }
}
