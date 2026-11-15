import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/infrastructure/redis-client";

/**
 * Health check + Redis keep-alive.
 *
 * Called once a day by Vercel Cron (see vercel.json). The write keeps the
 * free Upstash database "active" — Upstash archives free databases after
 * ~30 days without traffic, which silently disabled rate limiting and the
 * events cache in production. A 503 here is logged as an error, so a dead
 * Redis now shows up in Vercel Runtime Errors instead of going unnoticed.
 *
 * Protected by CRON_SECRET: Vercel sends `Authorization: Bearer <secret>`
 * on cron invocations.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedisClient();
  if (!redis) {
    console.error("[health] redis down: client unavailable (REDIS_URL missing or cooling down)");
    return NextResponse.json({ redis: "unavailable" }, { status: 503 });
  }

  try {
    await redis.set(
      "keepalive:last",
      new Date().toISOString(),
      "EX",
      60 * 60 * 24 * 40
    );
    await redis.ping();
    return NextResponse.json({ redis: "ok" });
  } catch (err) {
    console.error("[health] redis down:", err);
    return NextResponse.json({ redis: "unavailable" }, { status: 503 });
  }
}
