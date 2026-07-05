/**
 * Payoff judge — the reframed, primary judge.
 *
 * Instead of "did the story diverge anywhere?" (recapJudge — a partly closed-book
 * question neither human nor model judges reliably on obscure years), this judge
 * asks the OPEN-BOOK, product-relevant question:
 *
 *     "Does the PRESENT-DAY (2025) world the story describes meaningfully
 *      differ from our real 2025?"
 *
 * Why this is the better anchor (discovered with the human grader):
 *   - It only needs knowledge of OUR actual present — common knowledge → both a
 *     person and the model judge it reliably (open book).
 *   - It is the product's PAYOFF — the world the user actually feels at the end.
 *   - It catches BOTH failure modes at once: a pure recap AND a divergence that
 *     fizzled back to our world both end in a present ≈ ours.
 *
 * Human and judge see the SAME input — only the present-day beat (last
 * paragraph) — so the calibration is apples-to-apples.
 *
 * Labels: "same_world" = the failure (present ≈ ours), "different_world" = good.
 */
import type { PromptSpec } from "@/lib/ai/prompts";
import { yearLabel } from "@/lib/ai/prompts";
import { SCENARIO_MODEL } from "@/constants";

export function judgeModel(): string {
  return process.env.JUDGE_MODEL || SCENARIO_MODEL;
}

export type PayoffVerdict = "same_world" | "different_world" | "unknown";

/** The present-day beat = the last non-empty paragraph (the "World 2025" beat). */
export function presentDayBeat(output: string): string {
  const paras = output
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paras.length ? paras[paras.length - 1] : output.trim();
}

export function payoffJudgePrompt(args: { year: number; present: string }): PromptSpec {
  const { year, present } = args;
  return {
    model: judgeModel(),
    maxTokens: 200,
    messages: [
      {
        role: "system",
        content:
          "You evaluate an alternative-history story by ONE criterion: does the PRESENT-DAY (2025) world it describes meaningfully differ from our real 2025? You only need to know our real present world. Reply with JSON only, no markdown.",
      },
      {
        role: "user",
        content: `This is the present-day ("2025 in this timeline") paragraph of an alternative history whose divergence was set in the year ${yearLabel(
          year
        )}. A good alternative history ends in a present that is meaningfully DIFFERENT from our real 2025.

Classify this present-day world:
- "same_world": the MATERIAL present is essentially OUR real 2025 — the same nations, institutions, technology level, and daily social order, with at most cosmetic differences. (Failure: a recap, or a divergence that fizzled back to our world.) A paragraph that describes our real present and then only muses about "what is missing" or a "road not taken" is STILL same_world — judge the present it actually describes, not the counterfactual it gestures at.
- "different_world": the MATERIAL present is meaningfully different from our real 2025. This includes not only nations that don't exist / are missing or a different technology level, but ALSO a recognizably altered civilization — a different religious-intellectual order, materially altered core institutions (e.g. a differently-governed internet, a different linguistic/orthographic standard), or a materially different cultural landscape. Identical consumer technology (smartphones, the internet, streaming) does NOT by itself make a world "same_world" when its institutions or culture are materially altered.

Compare only against our real present world. Ignore how plausible the path was.

Return ONLY: {"verdict":"same_world"|"different_world","reason":"<one short sentence naming the concrete present-day detail that decided it>"}

PRESENT-DAY PARAGRAPH:
"""
${present}
"""`,
      },
    ],
  };
}

export function parsePayoffVerdict(text: string): { verdict: PayoffVerdict; reason: string } {
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const o = JSON.parse(clean) as { verdict?: string; reason?: string };
    const v = String(o.verdict ?? "").toLowerCase();
    if (v === "same_world" || v === "different_world")
      return { verdict: v, reason: String(o.reason ?? "").trim() };
  } catch {
    /* fall through */
  }
  const low = clean.toLowerCase();
  if (low.includes("different")) return { verdict: "different_world", reason: clean.slice(0, 160) };
  if (low.includes("same")) return { verdict: "same_world", reason: clean.slice(0, 160) };
  return { verdict: "unknown", reason: clean.slice(0, 160) };
}
