import { describe, it, expect } from "vitest";
import { formatYear } from "@/lib/formatYear";

describe("formatYear", () => {
  it("returns plain string for positive years", () => {
    expect(formatYear(1969)).toBe("1969");
    expect(formatYear(2024)).toBe("2024");
    expect(formatYear(1)).toBe("1");
  });

  it("returns '0' for year zero", () => {
    expect(formatYear(0)).toBe("0");
  });

  it("appends BC for negative years", () => {
    expect(formatYear(-1)).toBe("1 BC");
    expect(formatYear(-753)).toBe("753 BC");
    expect(formatYear(-3000)).toBe("3000 BC");
  });

  it("uses absolute value for BC label (no minus sign)", () => {
    const result = formatYear(-500);
    expect(result).not.toContain("-");
    expect(result).toBe("500 BC");
  });
});
