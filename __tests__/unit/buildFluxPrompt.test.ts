import { describe, it, expect } from "vitest";
import { buildFluxPrompt } from "@/lib/ai/image";

describe("buildFluxPrompt", () => {
  it("includes era label for AD years", () => {
    const prompt = buildFluxPrompt("Moon landing", "Apollo 11 never launched", 1969);
    expect(prompt).toContain("1969 AD");
    expect(prompt).toContain("Moon landing");
    expect(prompt).toContain("Apollo 11 never launched");
  });

  it("formats BC years correctly", () => {
    const prompt = buildFluxPrompt("Rome founded", "Rome never founded", -753);
    expect(prompt).toContain("753 BC");
  });

  it("includes cinematic style keywords", () => {
    const prompt = buildFluxPrompt("Test", "Test scenario", 2000);
    expect(prompt).toMatch(/cinematic/i);
    expect(prompt).toContain("no text");
    expect(prompt).toContain("no watermarks");
  });

  it("returns a non-empty string", () => {
    const prompt = buildFluxPrompt("", "", 0);
    expect(prompt.length).toBeGreaterThan(0);
  });
});
