import { NextRequest, NextResponse } from "next/server";
import { pollVideoTask } from "@/lib/video-providers/kling";
import { getClientIp } from "@/lib/rateLimit";
import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Development bypass — skip Redis premium check in local dev
// ---------------------------------------------------------------------------

const SKIP_PREMIUM = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Premium check (shared pattern — consider extracting to lib/premium.ts later)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
let redisUnavailable = false;

function getRedis(): Redis | null {
  if (redisUnavailable) return null;
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      redisUnavailable = true;
      return null;
    }
    redis = new Redis(url, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on("error", () => {
      redisUnavailable = true;
      redis = null;
    });
  }
  return redis;
}

async function isPremium(ip: string): Promise<boolean> {
  if (SKIP_PREMIUM) return true;
  const r = getRedis();
  if (!r) return false;
  try {
    const val = await r.get(`premium:${ip}`);
    return val === "true" || val === "1";
  } catch {
    return false;
  }
}

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
