/**
 * Component tests for EventCard.
 *
 * Covers: impact badge colours, toggle button states, thumbnail display,
 * rank overlays, Wikipedia / source links, happened vs erased styling.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventCard from "@/components/features/EventCard/EventCard";
import type { HistoricalEvent } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Partial<HistoricalEvent>): HistoricalEvent {
  return {
    id: "1",
    title: "Moon Landing",
    description: "First humans on the moon.",
    impact: "high",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("EventCard — basic rendering", () => {
  it("renders title and description", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.getByText("Moon Landing")).toBeInTheDocument();
    expect(screen.getByText("First humans on the moon.")).toBeInTheDocument();
  });

  it("renders impact badge with impact label", () => {
    render(<EventCard event={makeEvent({ impact: "high" })} />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders thumbnail image when provided", () => {
    render(
      <EventCard
        event={makeEvent({ thumbnail: "https://example.com/moon.jpg" })}
      />
    );
    const img = screen.getByRole("img", { name: /Moon Landing/i });
    expect(img).toHaveAttribute("src", "https://example.com/moon.jpg");
  });

  it("does NOT render an img when thumbnail is absent", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Impact badge colours (border-left accent via className)
// ---------------------------------------------------------------------------

describe("EventCard — impact accent classes", () => {
  it("applies red accent for high impact", () => {
    const { container } = render(<EventCard event={makeEvent({ impact: "high" })} />);
    expect(container.firstChild).toHaveClass("border-l-red-500");
  });

  it("applies yellow accent for medium impact", () => {
    const { container } = render(<EventCard event={makeEvent({ impact: "medium" })} />);
    expect(container.firstChild).toHaveClass("border-l-yellow-500");
  });

  it("applies blue accent for low impact", () => {
    const { container } = render(<EventCard event={makeEvent({ impact: "low" })} />);
    expect(container.firstChild).toHaveClass("border-l-blue-400");
  });
});

// ---------------------------------------------------------------------------
// Rank display
// ---------------------------------------------------------------------------

describe("EventCard — rank", () => {
  it("shows zero-padded rank number when rank + no thumbnail", () => {
    render(<EventCard event={makeEvent()} rank={3} />);
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("shows rank overlay on thumbnail when both are provided", () => {
    render(
      <EventCard
        event={makeEvent({ thumbnail: "https://example.com/moon.jpg" })}
        rank={1}
      />
    );
    // Both the rank overlay and the img should be present
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("does not render rank element when rank is not provided", () => {
    render(<EventCard event={makeEvent()} />);
    // "01"/"02"/"03" should not appear
    expect(screen.queryByText(/^0\d$/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// External links
// ---------------------------------------------------------------------------

describe("EventCard — source and Wikipedia links", () => {
  it("renders Wikipedia link when wikipediaUrl is provided", () => {
    render(
      <EventCard
        event={makeEvent({ wikipediaUrl: "https://en.wikipedia.org/wiki/Apollo_11" })}
      />
    );
    const link = screen.getByText(/Wikipedia/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Apollo_11");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does NOT render Wikipedia link when wikipediaUrl is absent", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.queryByText(/Wikipedia/i)).not.toBeInTheDocument();
  });

  it("renders Source link when sourceUrl is provided", () => {
    render(
      <EventCard
        event={makeEvent({ sourceUrl: "https://nasa.gov/apollo" })}
      />
    );
    const link = screen.getByText(/Source/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://nasa.gov/apollo");
  });

  it("does NOT render Source link when sourceUrl is absent", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.queryByText(/Source ↗/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Toggle buttons
// ---------------------------------------------------------------------------

describe("EventCard — toggle buttons", () => {
  it("renders Keep it and Erase it buttons when onToggle is provided", () => {
    render(<EventCard event={makeEvent()} onToggle={vi.fn()} />);
    expect(screen.getByText(/✓ Keep it/i)).toBeInTheDocument();
    expect(screen.getByText(/✗ Erase it/i)).toBeInTheDocument();
  });

  it("does NOT render toggle buttons without onToggle", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.queryByText(/Keep it/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Erase it/i)).not.toBeInTheDocument();
  });

  it("calls onToggle(id, true) when Keep it is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<EventCard event={makeEvent({ id: "evt-1" })} onToggle={onToggle} />);

    await user.click(screen.getByText(/✓ Keep it/i));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith("evt-1", true);
  });

  it("calls onToggle(id, false) when Erase it is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<EventCard event={makeEvent({ id: "evt-1" })} onToggle={onToggle} />);

    await user.click(screen.getByText(/✗ Erase it/i));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith("evt-1", false);
  });
});

// ---------------------------------------------------------------------------
// happened vs erased card styling
// ---------------------------------------------------------------------------

describe("EventCard — happened / erased styling", () => {
  it("applies normal border style when happened=true (default)", () => {
    const { container } = render(<EventCard event={makeEvent()} happened={true} />);
    expect(container.firstChild).toHaveClass("border-gray-700");
    expect(container.firstChild).not.toHaveClass("opacity-70");
  });

  it("applies erased styling when happened=false", () => {
    const { container } = render(<EventCard event={makeEvent()} happened={false} />);
    expect(container.firstChild).toHaveClass("opacity-70");
    expect(container.firstChild).toHaveClass("border-red-800/50");
  });
});
