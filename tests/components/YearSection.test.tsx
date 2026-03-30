/**
 * Component tests for YearSection.
 *
 * Covers: initial render, era label, year display (including BCE),
 * slider interaction, number input, submit button text, navigation call.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock next/navigation and next/dynamic before importing the component
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// StarField is loaded with next/dynamic — stub it out to avoid Three.js issues
vi.mock("next/dynamic", () => ({
  default: () => () => <canvas data-testid="starfield" />,
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are in place
// ---------------------------------------------------------------------------

import YearSection from "@/components/features/YearSection/index";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("YearSection — initial render", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("displays the default year 1969", () => {
    render(<YearSection />);
    expect(screen.getByText("1969")).toBeInTheDocument();
  });

  it('shows "Cold War" era label for year 1969', () => {
    render(<YearSection />);
    expect(screen.getByText("Cold War")).toBeInTheDocument();
  });

  it('shows "Travel to 1969" on the submit button', () => {
    render(<YearSection />);
    expect(
      screen.getByRole("button", { name: /Travel to 1969/i })
    ).toBeInTheDocument();
  });

  it("renders the year slider", () => {
    render(<YearSection />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "-3000");
    expect(slider).toHaveAttribute("max", "2024");
  });

  it("renders the numeric input with value 1969", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(1969);
  });
});

describe("YearSection — era labels", () => {
  beforeEach(() => mockPush.mockReset());

  const cases: [number, string][] = [
    [-1000, "Ancient World"],
    [-200, "Classical Era"],
    [800, "Middle Ages"],
    [1500, "Renaissance"],
    [1800, "Industrial Age"],
    [1920, "World Wars"],
    [1969, "Cold War"],
    [2000, "Modern Era"],
  ];

  for (const [year, label] of cases) {
    it(`shows "${label}" for year ${year}`, () => {
      render(<YearSection />);
      const slider = screen.getByRole("slider");
      // Change slider to the target year
      fireEvent.change(slider, { target: { value: String(year) } });
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }
});

describe("YearSection — BCE year formatting", () => {
  beforeEach(() => mockPush.mockReset());

  it("displays negative year as BC (e.g., -753 → '753 BC')", () => {
    render(<YearSection />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "-753" } });
    expect(screen.getByText("753 BC")).toBeInTheDocument();
  });

  it('shows "Travel to 753 BC" on button when year is -753', () => {
    render(<YearSection />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "-753" } });
    expect(
      screen.getByRole("button", { name: /Travel to 753 BC/i })
    ).toBeInTheDocument();
  });
});

describe("YearSection — number input interaction", () => {
  beforeEach(() => mockPush.mockReset());

  it("updates year display when number input changes", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "1945" } });
    expect(screen.getByText("1945")).toBeInTheDocument();
  });

  it("ignores empty string input (NaN guard)", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    // Default is 1969 — clearing should not produce NaN
    fireEvent.change(input, { target: { value: "" } });
    // Year should remain 1969 (unchanged)
    expect(screen.getByText("1969")).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });

  it("ignores bare minus sign input (typing negative year)", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-" } });
    // Year should remain 1969 (unchanged)
    expect(screen.getByText("1969")).toBeInTheDocument();
  });

  it("clamps input to MAX_YEAR when value exceeds upper bound", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "9999" } });
    // Should be clamped to 2024 (MAX_YEAR)
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("clamps input to MIN_YEAR when value exceeds lower bound", () => {
    render(<YearSection />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-5000" } });
    // Should be clamped to -3000 (MIN_YEAR) → displayed as "3000 BC"
    expect(screen.getByText("3000 BC")).toBeInTheDocument();
  });

  it("NaN guard on range slider — non-numeric value does not produce NaN", () => {
    render(<YearSection />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "abc" } });
    // NaN should never appear in the rendered output
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });
});

describe("YearSection — form submission", () => {
  beforeEach(() => mockPush.mockReset());

  it("navigates to /events/{year}?lang=en when submitted", async () => {
    const user = userEvent.setup();
    render(<YearSection />);

    await user.click(screen.getByRole("button", { name: /Travel to 1969/i }));

    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/events/1969?lang=en");
  });

  it("navigates with the updated year after slider change", async () => {
    const user = userEvent.setup();
    render(<YearSection />);

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "1789" } });

    await user.click(screen.getByRole("button", { name: /Travel to 1789/i }));

    expect(mockPush).toHaveBeenCalledWith("/events/1789?lang=en");
  });

  it("disables submit button and shows Loading... after click", async () => {
    const user = userEvent.setup();
    render(<YearSection />);

    const btn = screen.getByRole("button", { name: /Travel to 1969/i });
    await user.click(btn);

    expect(screen.getByRole("button", { name: /Loading/i })).toBeDisabled();
  });
});
