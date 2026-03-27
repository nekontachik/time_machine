import "server-only";
import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/infrastructure/redis-client";

// Dev-only cache clearing endpoint — blocked in production
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json({ message: "No Redis client — nothing to clear" });
    }

    const keys = await redis.keys("events:*");
    if (keys.length === 0) {
      return NextResponse.json({ message: "Cache already empty", deleted: 0 });
    }

    const deleted = await redis.del(...keys);
    return NextResponse.json({ message: "Cache cleared", deleted, keys });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
