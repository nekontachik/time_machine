import "server-only";
import { getRedisClient } from "@/lib/infrastructure/redis-client";

/**
 * Shared premium-check utility.
 *
 * Premium status is stored in Redis as `premium:{ip}` = "true" | "1".
 * In development mode, all users are treated as premium (SKIP_PREMIUM = true).
 */

const SKIP_PREMIUM = process.env.NODE_ENV === "development";

export async function isPremium(ip: string): Promise<boolean> {
  if (SKIP_PREMIUM) return true;

  const r = getRedisClient();
  if (!r) return false;

  try {
    const val = await r.get(`premium:${ip}`);
    return val === "true" || val === "1";
  } catch {
    return false;
  }
}
