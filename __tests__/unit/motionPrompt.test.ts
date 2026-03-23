import { describe, it, expect } from "vitest";
import { buildMotionPrompt, detectScenarioType } from "@/lib/motionPrompt";
import type { ScenarioType } from "@/lib/motionPrompt";

describe("detectScenarioType", () => {
  it("detects disaster scenarios", () => {
    expect(detectScenarioType("World War II", "The war never happened")).toBe(
      "prevented_disaster"
    );
  });

  it("detects invention scenarios", () => {
    expect(
      detectScenarioType("Telephone invented", "Bell never patented the device")
    ).toBe("changed_invention");
  });

  it("detects politics scenarios", () => {
    expect(
      detectScenarioType(
        "US election 1860",
        "Lincoln lost the presidential election"
      )
    ).toBe("altered_politics");
  });

  it("detects discovery scenarios", () => {
    expect(
      detectScenarioType("Penicillin", "Fleming never discovered the cure")
    ).toBe("different_discovery");
  });

  it("falls back to personal_choice when no keywords match", () => {
    expect(detectScenarioType("Something", "Something else")).toBe(
      "personal_choice"
    );
  });

  it("picks the type with the most keyword matches", () => {
    // "war", "bomb", "attack" = 3 disaster keywords vs "election" = 1 politics
    const result = detectScenarioType(
      "The bombing attack during war",
      "election held anyway"
    );
    expect(result).toBe("prevented_disaster");
  });
});

describe("buildMotionPrompt", () => {
  it("returns a string under 50 words", () => {
    const prompt = buildMotionPrompt(
      "World War II ended early",
      "The allied forces negotiated peace in 1943",
      1943
    );
    const wordCount = prompt.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(50);
  });

  it("includes era context for ancient years", () => {
    const prompt = buildMotionPrompt("Rome fell", "Empire survived", -500);
    expect(prompt).toContain("BCE");
    expect(prompt).toContain("ancient");
  });

  it("includes era context for medieval years", () => {
    const prompt = buildMotionPrompt("Crusades", "Crusades prevented", 800);
    expect(prompt).toContain("medieval");
    expect(prompt).toContain("CE");
  });

  it("appends year directly for modern era", () => {
    const prompt = buildMotionPrompt("Moon landing", "Failed mission", 1969);
    expect(prompt).toContain("1969");
  });

  it("uses disaster template for war-related events", () => {
    const prompt = buildMotionPrompt(
      "World War I",
      "The conflict was avoided",
      1914
    );
    // Disaster template mentions "city skyline" and "celebrating"
    expect(prompt).toMatch(/skyline|celebrating/i);
  });

  it("uses invention template for technology events", () => {
    const prompt = buildMotionPrompt(
      "Computer invented",
      "The machine was never built",
      1945
    );
    expect(prompt).toMatch(/machinery|gears|workshop/i);
  });
});
