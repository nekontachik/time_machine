import { describe, it, expect, vi, beforeEach } from "vitest";

// Force mock mode by clearing env before import
vi.stubEnv("FAL_KEY", "");

// We need to dynamically import after setting env
let createVideoTask: typeof import("@/lib/video-providers/kling").createVideoTask;
let pollVideoTask: typeof import("@/lib/video-providers/kling").pollVideoTask;

beforeEach(async () => {
  // Re-import to pick up env changes
  const mod = await import("@/lib/video-providers/kling");
  createVideoTask = mod.createVideoTask;
  pollVideoTask = mod.pollVideoTask;
});

describe("Video provider (mock mode)", () => {
  it("createVideoTask returns a pending task with mock taskId", async () => {
    const result = await createVideoTask({
      imageUrl: "https://example.com/img.jpg",
      prompt: "Camera pans across battlefield",
      duration: 5,
    });

    expect(result.taskId).toMatch(/^mock_task_/);
    expect(result.status).toBe("pending");
    expect(result.videoUrl).toBeUndefined();
  });

  it("pollVideoTask returns processing for first 2 polls, then completed", async () => {
    const created = await createVideoTask({
      imageUrl: "https://example.com/img.jpg",
      prompt: "Slow zoom into ancient ruins",
      duration: 10,
    });

    // Poll 1 — processing
    const poll1 = await pollVideoTask(created.taskId);
    expect(poll1.status).toBe("processing");
    expect(poll1.videoUrl).toBeUndefined();

    // Poll 2 — still processing
    const poll2 = await pollVideoTask(created.taskId);
    expect(poll2.status).toBe("processing");

    // Poll 3 — completed
    const poll3 = await pollVideoTask(created.taskId);
    expect(poll3.status).toBe("completed");
    expect(poll3.videoUrl).toBeDefined();
    expect(poll3.videoUrl).toContain("http");
  });

  it("createVideoTask accepts duration 5 and 10", async () => {
    const r5 = await createVideoTask({
      imageUrl: "https://example.com/img.jpg",
      prompt: "Test",
      duration: 5,
    });
    expect(r5.taskId).toBeTruthy();

    const r10 = await createVideoTask({
      imageUrl: "https://example.com/img.jpg",
      prompt: "Test",
      duration: 10,
    });
    expect(r10.taskId).toBeTruthy();

    // Different tasks get different IDs
    expect(r5.taskId).not.toBe(r10.taskId);
  });
});
