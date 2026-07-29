import { describe, it, expect } from "vitest";
import { getClientIp, getClientIpFromHeaders } from "@/lib/infrastructure/rate-limit";
import type { NextRequest } from "next/server";

/**
 * The rate-limit key must not be derived from a header the client fully
 * controls where a trustworthy one is available. x-forwarded-for's leftmost
 * value is attacker-supplied; x-vercel-forwarded-for is written by the edge.
 */
function req(headers: Record<string, string>, ip?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    ip,
  } as unknown as NextRequest;
}

describe("getClientIp precedence", () => {
  it("prefers the Vercel-written header over client-supplied x-forwarded-for", () => {
    const r = req({
      "x-vercel-forwarded-for": "9.9.9.9",
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    });
    expect(getClientIp(r)).toBe("9.9.9.9");
  });

  it("falls back to req.ip before trusting x-forwarded-for", () => {
    const r = req({ "x-forwarded-for": "1.2.3.4" }, "8.8.8.8");
    expect(getClientIp(r)).toBe("8.8.8.8");
  });

  it("still uses x-forwarded-for when nothing better exists", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4"
    );
  });

  it("never collapses every visitor into one permanent bucket", () => {
    // A single constant key would let the 4th anonymous request lock out the
    // whole site for the rest of the day. The fallback is minute-scoped.
    const key = getClientIp(req({}));
    expect(key).toMatch(/^unknown_\d+$/);
    expect(key).not.toBe("unknown");
  });

  it("applies the same precedence to the SSR headers() variant", () => {
    const headers = {
      get: (name: string) =>
        ({
          "x-vercel-forwarded-for": "9.9.9.9",
          "x-forwarded-for": "1.2.3.4",
        })[name.toLowerCase()] ?? null,
    };
    expect(getClientIpFromHeaders(headers)).toBe("9.9.9.9");
  });
});
