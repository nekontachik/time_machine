import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getClientIp,
  getClientIpFromHeaders,
  rateLimitKeyForIp,
} from "@/lib/infrastructure/rate-limit";
import type { NextRequest } from "next/server";

/**
 * An IPv6 client usually owns a whole /64 and can rotate through 2^64
 * addresses. Keying the daily limit on the full address would give each
 * request a fresh bucket, so IPv6 is keyed on its /64 prefix instead.
 */
function req(headers: Record<string, string>, ip?: string): NextRequest {
  return {
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    ip,
  } as unknown as NextRequest;
}

describe("rateLimitKeyForIp", () => {
  it("leaves IPv4 unchanged", () => {
    expect(rateLimitKeyForIp("203.0.113.7")).toBe("203.0.113.7");
  });

  it("collapses every address in one /64 into the same key", () => {
    const a = rateLimitKeyForIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = rateLimitKeyForIp("2001:db8:1:2::1");
    const c = rateLimitKeyForIp("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff");
    expect(a).toBe("v6:2001:db8:1:2::/64");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("keeps different /64 networks in different buckets", () => {
    expect(rateLimitKeyForIp("2001:db8:1:2::1")).not.toBe(
      rateLimitKeyForIp("2001:db8:1:3::1")
    );
  });

  it("handles compressed forms at the start and end", () => {
    expect(rateLimitKeyForIp("::1")).toBe("v6:0:0:0:0::/64");
    expect(rateLimitKeyForIp("2001:db8::")).toBe("v6:2001:db8:0:0::/64");
  });

  it("unwraps IPv4-mapped IPv6 to plain IPv4", () => {
    expect(rateLimitKeyForIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitKeyForIp("::FFFF:203.0.113.7")).toBe("203.0.113.7");
  });

  it("handles embedded IPv4 in other prefixes (NAT64)", () => {
    expect(rateLimitKeyForIp("64:ff9b::203.0.113.7")).toBe(
      "v6:64:ff9b:0:0::/64"
    );
  });

  it("strips brackets, port and zone id", () => {
    expect(rateLimitKeyForIp("[2001:db8:1:2::5]:443")).toBe(
      "v6:2001:db8:1:2::/64"
    );
    expect(rateLimitKeyForIp("fe80::1%eth0")).toBe("v6:fe80:0:0:0::/64");
  });

  it("returns malformed input unchanged rather than throwing", () => {
    expect(rateLimitKeyForIp("not-an-ip")).toBe("not-an-ip");
    expect(rateLimitKeyForIp("1::2::3")).toBe("1::2::3");
    expect(rateLimitKeyForIp("gggg::1")).toBe("gggg::1");
    expect(rateLimitKeyForIp("1:2:3:4:5:6:7:8:9")).toBe("1:2:3:4:5:6:7:8:9");
  });
});

describe("getClientIp uses the /64 key for IPv6", () => {
  it("normalises the Vercel header", () => {
    const r = req({ "x-vercel-forwarded-for": "2001:db8:1:2::abcd" });
    expect(getClientIp(r)).toBe("v6:2001:db8:1:2::/64");
  });

  it("normalises req.ip and x-forwarded-for fallbacks", () => {
    expect(getClientIp(req({}, "2001:db8:1:2::9"))).toBe(
      "v6:2001:db8:1:2::/64"
    );
    expect(
      getClientIp(req({ "x-forwarded-for": "2001:db8:1:2::9, 10.0.0.1" }))
    ).toBe("v6:2001:db8:1:2::/64");
  });

  it("normalises the SSR headers() variant the same way", () => {
    const headers = {
      get: (n: string) =>
        n.toLowerCase() === "x-vercel-forwarded-for" ? "2001:db8:1:2::77" : null,
    };
    expect(getClientIpFromHeaders(headers)).toBe("v6:2001:db8:1:2::/64");
  });
});
