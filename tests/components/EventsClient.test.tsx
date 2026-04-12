/**
 * Component tests for EventsClient.
 *
 * Covers: hint text when no events erased, generate button visibility,
 * generate button disabled state, navigation call on generate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// EventCard is a complex component — stub it for faster, isolated tests
vi.mock("@/components/features/EventCard/EventCard", () => ({
  default: ({
    event,
    happened,
    onToggle,
  }: {
    event: { id: string; title: string };
    happened?: boolean;
    onToggle?: (id: string, happened: boolean) => void;
  }) => (
    <div data-testid={`event-card-${event.id}`}>
      <span>{event.title}</span>
      {onToggle && (
        <>
          <button onClick={() => onToggle(event.id, true)}>✓ Keep it</button>
          <button onClick={() => onToggle(event.id, false)}>✗ Erase it</button>
        </>
      )}
      <span data-testid={`happened-${event.id}`}>
        {happened ? "kept" : "erased"}
      </span>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import EventsClient from "@/app/events/[year]/EventsClient";
import type { HistoricalEvent } from "@/types";

const EVENTS: HistoricalEvent[] = [
  { id: "1", title: "Moon Landing", description: "First human on the moon", impact: "high" },
  { id: "2", title: "Woodstock", description: "Iconic music festival", impact: "medium" },
];

// ---------------------------------------------------------------------------
// Helpers — advance through the step machine (year-reveal → choice)
// ---------------------------------------------------------------------------

/**
 * Fast-forward past year-reveal (1600ms) + card stagger (400ms per card).
 * After this, step === "choice" and all cards + buttons are visible.
 */
async function advanceToChoice(eventCount: number) {
  // year-reveal phase
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });
  // card stagger phase
  for (let i = 0; i < eventCount; i++) {
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventsClient — hint and generate button", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows hint text when no events are erased", async () => {
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    await advanceToChoice(EVENTS.length);

    // No events toggled off → hint should appear
    expect(
      screen.getByText(/at least one event/i)
    ).toBeInTheDocument();

    // Generate button should NOT be visible
    expect(
      screen.queryByRole("button", { name: /Generate Scenario/i })
    ).not.toBeInTheDocument();
  });

  it("shows generate button after erasing an event (hint disappears)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    await advanceToChoice(EVENTS.length);

    // Erase the first event
    const eraseButtons = screen.getAllByText("✗ Erase it");
    await user.click(eraseButtons[0]);

    // Generate button should now appear
    expect(
      screen.getByRole("button", { name: /Generate Scenario/i })
    ).toBeInTheDocument();

    // Hint should disappear
    expect(
      screen.queryByText(/at least one event/i)
    ).not.toBeInTheDocument();
  });

  it("navigates to /scenario with correct params on generate", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    await advanceToChoice(EVENTS.length);

    // Erase Moon Landing
    const eraseButtons = screen.getAllByText("✗ Erase it");
    await user.click(eraseButtons[0]);

    // Click generate
    await user.click(screen.getByRole("button", { name: /Generate Scenario/i }));

    expect(mockPush).toHaveBeenCalledOnce();
    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("/scenario?");
    expect(url).toContain("year=1969");
    expect(url).toContain("lang=en");
    // Events payload should include Moon Landing as happened=false
    const params = new URLSearchParams(url.split("?")[1]);
    const events = JSON.parse(params.get("events")!);
    expect(events).toEqual([
      { id: "1", happened: false, title: "Moon Landing" },
      { id: "2", happened: true, title: "Woodstock" },
    ]);
    // eventTitle should be set to the first erased event
    expect(params.get("eventTitle")).toBe("Moon Landing");
  });

  it("disables generate button and shows spinner after clicking", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    await advanceToChoice(EVENTS.length);

    // Erase an event
    const eraseButtons = screen.getAllByText("✗ Erase it");
    await user.click(eraseButtons[0]);

    // Click generate
    const btn = screen.getByRole("button", { name: /Generate Scenario/i });
    await user.click(btn);

    // Button should now show "Generating..." and be disabled
    expect(screen.getByRole("button", { name: /Generating/i })).toBeDisabled();
  });

  it("re-shows hint if user keeps all events after erasing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    await advanceToChoice(EVENTS.length);

    // Erase an event
    const eraseButtons = screen.getAllByText("✗ Erase it");
    await user.click(eraseButtons[0]);
    expect(screen.getByRole("button", { name: /Generate Scenario/i })).toBeInTheDocument();

    // Keep it back
    const keepButtons = screen.getAllByText("✓ Keep it");
    await user.click(keepButtons[0]);

    // Hint should return, generate button should disappear
    expect(screen.getByText(/at least one event/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Scenario/i })).not.toBeInTheDocument();
  });
});

describe("EventsClient — year reveal phase", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows year number during year-reveal phase", () => {
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    expect(screen.getByText("1969")).toBeInTheDocument();
  });

  it("shows BCE format for negative years", () => {
    render(<EventsClient events={EVENTS} year={-500} lang="en" />);
    expect(screen.getByText("500 BCE")).toBeInTheDocument();
  });

  it("does not show hint or generate button during year-reveal", () => {
    render(<EventsClient events={EVENTS} year={1969} lang="en" />);
    expect(screen.queryByText(/at least one event/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Scenario/i })).not.toBeInTheDocument();
  });
});
