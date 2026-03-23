import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("FAL_KEY", "");
vi.stubEnv("NODE_ENV", "development"); // SKIP_PREMIUM = true

// Mock rate limit
vi.mock("@/lib/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// Mock premium (dev mode bypasses, but we mock for clarity)
vi.mock("@/lib/premium", () => ({
  isPremium: vi.fn().mockResolvedValue(true),
}));

describe("POST /api/video/create", () => {
  let POST: typeof import("@/app/api/video/create/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/video/create/route");
    POST = mod.POST;
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/video/create", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields missing", async () => {
    const req = new Request("http://localhost:3000/api/video/create", {
      method: "POST",
      body: JSON.stringify({ imageUrl: "https://example.com/img.jpg" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration", async () => {
    const req = new Request("http://localhost:3000/api/video/create", {
      method: "POST",
      body: JSON.stringify({
        imageUrl: "https://example.com/img.jpg",
        prompt: "Test",
        duration: 15,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("duration");
  });

  it("creates a mock video task with valid input", async () => {
    const req = new Request("http://localhost:3000/api/video/create", {
      method: "POST",
      body: JSON.stringify({
        imageUrl: "https://example.com/img.jpg",
        prompt: "Camera pans across battlefield",
        duration: 5,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toMatch(/^mock_task_/);
    expect(body.status).toBe("pending");
  });
});

describe("GET /api/video/status", () => {
  let GET: typeof import("@/app/api/video/status/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/video/status/route");
    GET = mod.GET;
  });

  it("returns 400 when taskId is missing", async () => {
    const req = new Request("http://localhost:3000/api/video/status");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("taskId");
  });

  it("returns processing status for a mock task", async () => {
    const req = new Request(
      "http://localhost:3000/api/video/status?taskId=mock_task_123"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(["pending", "processing", "completed"]).toContain(body.status);
  });
});

describe("Premium gate", () => {
  it("returns 403 when user is not premium", async () => {
    // Reset and re-mock with premium = false
    vi.resetModules();
    vi.doMock("@/lib/premium", () => ({
      isPremium: vi.fn().mockResolvedValue(false),
    }));
    vi.doMock("@/lib/rateLimit", () => ({
      getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
    }));

    const mod = await import("@/app/api/video/create/route");
    const req = new Request("http://localhost:3000/api/video/create", {
      method: "POST",
      body: JSON.stringify({
        imageUrl: "https://example.com/img.jpg",
        prompt: "Test",
        duration: 5,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await mod.POST(
      req as unknown as import("next/server").NextRequest
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Premium");
  });
});
