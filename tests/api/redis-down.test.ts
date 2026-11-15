import { describe, it, expect, vi, beforeEach } from "vitest";

const streamScenario = vi.fn();
const generateScenarioImage = vi.fn();
let result: { allowed: boolean; remaining: number; limit: number; reason?: string };

vi.mock("@/lib/infrastructure/rate-limit", () => ({
  checkBucketLimit: vi.fn(async () => result),
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/ai/text", () => ({ streamScenario }));
vi.mock("@/lib/ai/image", () => ({ generateScenarioImage }));

const scenarioBody = { year: 1969, events: [{ id: "1", happened: false }], lang: "en" };
const imageBody = { scenarioSummary: "A long enough summary", year: 1969 };

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("paid endpoints when Redis is unavailable", () => {
  beforeEach(() => {
    streamScenario.mockReset();
    generateScenarioImage.mockReset();
  });

  it("scenario → 503 and never calls the model", async () => {
    result = { allowed: false, remaining: 0, limit: 10, reason: "unavailable" };
    const { POST } = await import("@/app/api/scenario/route");
    const checkBucketLimit = (await import("@/lib/infrastructure/rate-limit")).checkBucketLimit;
    const res = await POST(post("http://x/api/scenario", scenarioBody));
    expect(res.status).toBe(503);
    expect(streamScenario).not.toHaveBeenCalled();
    expect(checkBucketLimit).toHaveBeenCalledWith("127.0.0.1", "scenario", { failClosed: true });
  });

  it("image → 503 and never calls fal.ai", async () => {
    result = { allowed: false, remaining: 0, limit: 10, reason: "unavailable" };
    const { POST } = await import("@/app/api/image/route");
    const res = await POST(post("http://x/api/image", imageBody));
    expect(res.status).toBe(503);
    expect(generateScenarioImage).not.toHaveBeenCalled();
  });

  it("scenario → still 429 when the daily limit is reached", async () => {
    result = { allowed: false, remaining: 0, limit: 10, reason: "limit" };
    const { POST } = await import("@/app/api/scenario/route");
    const res = await POST(post("http://x/api/scenario", scenarioBody));
    expect(res.status).toBe(429);
  });
});
