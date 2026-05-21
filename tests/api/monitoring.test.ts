import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as never;

describe("POST /api/monitoring — payload guards", () => {
  let POST: typeof import("@/app/api/monitoring/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/monitoring/route");
    POST = mod.POST;
  });

  it("rejects oversized payloads via content-length (H5)", async () => {
    const req = new Request("http://localhost/api/monitoring", {
      method: "POST",
      headers: { "content-length": String(100 * 1024) },
      body: "small actual body",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(413);
  });

  it("rejects oversized payloads where content-length lies (H5)", async () => {
    // Skip content-length, send a large body anyway
    const huge = "a".repeat(100 * 1024);
    const req = new Request("http://localhost/api/monitoring", {
      method: "POST",
      body: huge,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(413);
  });

  it("accepts small valid-looking envelopes", async () => {
    // Build a tiny envelope — first line is the header JSON
    const header = JSON.stringify({
      dsn: "https://abc@o4511131975090176.ingest.de.sentry.io/4511131978104912",
    });
    const envelope = `${header}\n{}`;
    const req = new Request("http://localhost/api/monitoring", {
      method: "POST",
      body: envelope,
    });
    const res = await POST(req as never);
    // 200 (forwarded) or any non-413 — we just want to confirm the size guard didn't fire
    expect(res.status).not.toBe(413);
  });
});
