/**
 * Component tests for ScenarioStream.
 *
 * These tests cover the rendering logic that pure unit / API tests miss:
 * - Loading skeleton visibility during streaming
 * - Streamed text rendering after completion
 * - Image rendering after the image API responds
 * - Image absent when imageUrl is null or a placeholder
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScenarioStream from "@/components/features/ScenarioStream/ScenarioStream";
import type { ScenarioRequest } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal ScenarioRequest fixture */
function makeRequest(overrides?: Partial<ScenarioRequest>): ScenarioRequest {
  return {
    year: 1941,
    lang: "en",
    events: [
      { id: "e1", happened: true },
      { id: "e2", happened: false },
    ],
    ...overrides,
  };
}

/**
 * Mock global fetch so we can control what the streaming + image endpoints
 * return without hitting a real server.
 *
 * Returns cleanup function to restore the original fetch.
 */
function mockFetch({
  scenarioChunks = ["Alternative history text."],
  imageUrl = "https://example.com/generated.jpg",
  videoTaskId = "task_123",
}: {
  scenarioChunks?: string[];
  imageUrl?: string | null;
  videoTaskId?: string;
} = {}) {
  const original = global.fetch;

  global.fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    // ── /api/scenario — streaming response ──────────────────────────────
    if (url.includes("/api/scenario")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of scenarioChunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    // ── /api/image ───────────────────────────────────────────────────────
    if (url.includes("/api/image")) {
      if (imageUrl) {
        return new Response(JSON.stringify({ imageUrl }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }

    // ── /api/video/create ────────────────────────────────────────────────
    if (url.includes("/api/video/create")) {
      return new Response(
        JSON.stringify({ taskId: videoTaskId, status: "pending" }),
        { status: 200 }
      );
    }

    // ── /api/video/status ────────────────────────────────────────────────
    if (url.includes("/api/video/status")) {
      return new Response(
        JSON.stringify({
          status: "completed",
          videoUrl: "https://example.com/video.mp4",
        }),
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  }) as typeof fetch;

  return () => { global.fetch = original; };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ScenarioStream", () => {
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders empty placeholder when no request is provided", () => {
    render(<ScenarioStream />);
    expect(
      screen.getByText(/Select events and click/i)
    ).toBeInTheDocument();
  });

  it("shows loading skeleton while waiting for first chunk", async () => {
    cleanup = mockFetch({ scenarioChunks: [] }); // stream never sends data
    render(<ScenarioStream request={makeRequest()} />);

    expect(screen.getByText(/Generating history/i)).toBeInTheDocument();
  });

  it("renders streamed scenario text after streaming completes", async () => {
    cleanup = mockFetch({
      scenarioChunks: ["World War II ended differently."],
      imageUrl: null, // no image so we don't wait for image state
    });

    render(<ScenarioStream request={makeRequest()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/World War II ended differently/i)
      ).toBeInTheDocument();
    });
  });

  it("shows image after streaming completes and image URL is returned", async () => {
    cleanup = mockFetch({
      scenarioChunks: ["The battle was won without bloodshed."],
      imageUrl: "https://example.com/img.jpg",
    });

    render(<ScenarioStream request={makeRequest()} />);

    // Wait for the scenario text, then the image
    await waitFor(
      () => {
        expect(screen.getByRole("img")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/img.jpg"
    );
  });

  it("does NOT show Generate Video button without imageUrl", async () => {
    cleanup = mockFetch({
      scenarioChunks: ["The battle was won."],
      imageUrl: null,
    });

    render(<ScenarioStream request={makeRequest()} />);

    await waitFor(() => {
      expect(screen.getByText(/The battle was won/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /Generate Video/i })
    ).not.toBeInTheDocument();
  });

  it("no Generate Video button is shown (feature currently disabled in UI)", async () => {
    cleanup = mockFetch({
      scenarioChunks: ["History changed."],
      imageUrl: "https://example.com/img.jpg",
    });

    render(<ScenarioStream request={makeRequest()} />);

    // Wait for the image to be rendered (streaming + image fetch complete)
    await waitFor(
      () => expect(screen.getByRole("img")).toBeInTheDocument(),
      { timeout: 3000 }
    );

    // The Generate Video button is currently commented out in the component
    expect(
      screen.queryByRole("button", { name: /Generate Video/i })
    ).not.toBeInTheDocument();
  });

  it("renders correctly when some events have happened=false (regression: !e.happened vs e.selected)", async () => {
    /**
     * Regression guard: EventToggle uses `happened: boolean`, not `selected`.
     * This ensures the component does not crash when processing an events
     * array that contains items with happened=false.
     */
    cleanup = mockFetch({
      scenarioChunks: ["Alternative outcome."],
      imageUrl: null,
    });

    const request = makeRequest({
      events: [
        { id: "happened-event", happened: true },
        { id: "counter-event", happened: false },
      ],
    });

    render(<ScenarioStream request={request} />);

    await waitFor(() => {
      expect(screen.getByText(/Alternative outcome/i)).toBeInTheDocument();
    });

    // Component rendered without crashing — field access was correct
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
