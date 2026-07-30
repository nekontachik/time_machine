/**
 * Tests for the ScenarioPage server component's render logic.
 *
 * Covers: navigation links, missing-params fallback, friendly error
 * message, back-to-events link with correct year.
 *
 * We mock ScenarioStream to avoid IntersectionObserver issues in jsdom
 * and to focus purely on the page shell / navigation / error handling.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the component
// ---------------------------------------------------------------------------

// Mock ScenarioStream to a simple stub
vi.mock("@/components/features/ScenarioStream/ScenarioStream", () => ({
  default: ({ request }: { request?: unknown }) => (
    <div data-testid="scenario-stream">
      {request ? "streaming" : "no-request"}
    </div>
  ),
}));

// Mock next/link to a simple anchor for testing href values
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Import the component AFTER mocks
// ---------------------------------------------------------------------------

import ScenarioPage from "@/app/scenario/page";

// ---------------------------------------------------------------------------
// Tests — missing params (error / fallback state)
// ---------------------------------------------------------------------------

describe("ScenarioPage — missing params fallback", () => {
  it("shows friendly message when no searchParams are provided", () => {
    render(<ScenarioPage searchParams={{}} />);

    // Should NOT show raw JSON error
    expect(screen.queryByText(/year, events, and lang are required/i)).not.toBeInTheDocument();

    // Should show user-friendly message (default lang is en)
    expect(
      screen.getByText(/No events selected/i)
    ).toBeInTheDocument();
  });

  it("shows English message when lang=en and events missing", () => {
    render(<ScenarioPage searchParams={{ lang: "en" }} />);

    expect(
      screen.getByText(/No events selected/i)
    ).toBeInTheDocument();
  });

  it("shows 'Back to events' link with correct year when year is present but events missing", () => {
    render(<ScenarioPage searchParams={{ year: "1969", lang: "en" }} />);

    const backLink = screen.getByText(/Back to events/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/events/1969?lang=en");
  });

  it("falls back to home link when neither year nor events are provided", () => {
    render(<ScenarioPage searchParams={{ lang: "en" }} />);

    // Both the top nav and the action button link to "/" since year is NaN
    const homeLinks = screen.getAllByText(/New scenario/i);
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of homeLinks) {
      expect(link.closest("a")).toHaveAttribute("href", "/");
    }
  });

  it("does NOT render ScenarioStream when request is invalid", () => {
    render(<ScenarioPage searchParams={{ lang: "en" }} />);

    expect(screen.queryByTestId("scenario-stream")).not.toBeInTheDocument();
  });

  it("shows fallback when events param is malformed JSON", () => {
    render(
      <ScenarioPage searchParams={{ year: "1969", lang: "en", events: "not-json" }} />
    );

    expect(screen.getByText(/No events selected/i)).toBeInTheDocument();
  });

  it("shows fallback when events array is empty", () => {
    render(
      <ScenarioPage searchParams={{ year: "1969", lang: "en", events: "[]" }} />
    );

    expect(screen.getByText(/No events selected/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — valid params (normal render with navigation)
// ---------------------------------------------------------------------------

describe("ScenarioPage — valid params navigation", () => {
  const validParams = {
    year: "1969",
    lang: "en",
    events: JSON.stringify([{ id: "1", happened: false }]),
  };

  it("renders ScenarioStream when params are valid", () => {
    render(<ScenarioPage searchParams={validParams} />);

    expect(screen.getByTestId("scenario-stream")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-stream")).toHaveTextContent("streaming");
  });

  it("shows 'New scenario' link back to events page", () => {
    render(<ScenarioPage searchParams={validParams} />);

    const backLink = screen.getByText(/New scenario/i);
    expect(backLink.closest("a")).toHaveAttribute("href", "/events/1969?lang=en");
  });

  it("shows 'Choose another year' link back to home", () => {
    render(<ScenarioPage searchParams={validParams} />);

    const yearLink = screen.getByText(/Choose another year/i);
    expect(yearLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("displays formatted year in the header", () => {
    render(<ScenarioPage searchParams={validParams} />);

    expect(screen.getByText("Year 1969")).toBeInTheDocument();
  });

  it("displays BCE year correctly", () => {
    render(
      <ScenarioPage
        searchParams={{
          ...validParams,
          year: "-500",
        }}
      />
    );

    expect(screen.getByText("Year 500 BC")).toBeInTheDocument();
  });
});
