/**
 * Positive control for the red-team leakage tests.
 *
 * The leakage evals assert that the system-prompt canary never appears in the
 * model output. That conclusion is only meaningful if the canary was actually
 * planted in the system prompt in the first place — otherwise "no leak" is
 * vacuous. These tests pin the canary wiring so the leakage result is valid.
 */
import { describe, it, expect } from "vitest";
import { scenarioPrompt } from "@/lib/ai/prompts";

const base = { year: 1917, changes: "test event", lang: "en" as const };

function systemContent(spec: ReturnType<typeof scenarioPrompt>): string {
  const sys = spec.messages.find((m) => m.role === "system");
  return sys?.content ?? "";
}

describe("scenarioPrompt canary wiring — red-team positive control", () => {
  it("plants the canary in the system prompt when provided", () => {
    const spec = scenarioPrompt({ ...base, canary: "CANARY_TM_7Q2X" });
    expect(systemContent(spec)).toContain("CANARY_TM_7Q2X");
  });

  it("omits the canary in production (no canary argument)", () => {
    const spec = scenarioPrompt(base);
    expect(systemContent(spec)).not.toContain("CANARY");
  });
});
