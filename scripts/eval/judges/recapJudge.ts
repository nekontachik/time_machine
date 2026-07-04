/**
 * Recap judge — LLM-as-judge for the #1 failure mode in TAXONOMY.md: `none-recap`.
 *
 * It classifies ONE scenario as:
 *   - "recap"          — the text retells REAL history / describes OUR actual
 *                        present (real nations, internet, smartphones, the same
 *                        2025 we live in) with no genuine divergence.
 *   - "counterfactual" — the text commits to a timeline that genuinely DIFFERS
 *                        from real history.
 *
 * Rubric is lifted verbatim from the taxonomy's definition of `none-recap`, so
 * the judge measures exactly the mode we coded by hand.
 *
 * On closed-book vs open-book: recap-detection leans on OPEN-BOOK cues — whether
 * the text commits to any divergence, and whether the described present matches
 * our actual (common-knowledge) world. That keeps it mostly out of the
 * shared-blind-spot trap. The residual closed-book tail (subtle recaps on
 * obscure years) is exactly what calibration on the golden set MEASURES — see
 * runJudge.ts. Do not trust this judge until calibration agreement is high.
 *
 * Model: defaults to SCENARIO_MODEL but overridable via JUDGE_MODEL. Tip: set
 * JUDGE_MODEL to a DIFFERENT family than the generator (claude-sonnet-4.6) to
 * avoid a model favouring its own outputs (self-preference bias).
 */
import type { PromptSpec } from "@/lib/ai/prompts";
import { yearLabel } from "@/lib/ai/prompts";
import { SCENARIO_MODEL } from "@/constants";

/** Read lazily (at call time) so JUDGE_MODEL works whether set inline on the
 *  command line OR loaded from .env.local by dotenv before the first call. */
export function judgeModel(): string {
  return process.env.JUDGE_MODEL || SCENARIO_MODEL;
}

export type Verdict = "recap" | "counterfactual" | "unknown";

export function recapJudgePrompt(args: {
  year: number;
  changes: string;
  scenario: string;
}): PromptSpec {
  const { year, changes, scenario } = args;
  return {
    model: judgeModel(),
    maxTokens: 200,
    messages: [
      {
        role: "system",
        content:
          "You are a strict evaluator for an alternative-history product. You judge ONE thing: did the text genuinely depart from real history, or did it merely retell real history / describe our actual present? Judge only what is written. Reply with JSON only, no markdown.",
      },
      {
        role: "user",
        content: `The product was asked to write an ALTERNATIVE history for the year ${yearLabel(
          year
        )}.
Changed events for this run: ${changes}

Classify the TEXT below into exactly one label:
- "recap": it essentially recounts REAL history and/or describes OUR ACTUAL present world (real nations, the internet, smartphones, the same 2025 we live in) with no genuine divergence. A faithful retelling of what really happened is a recap even when well written.
- "counterfactual": it commits to a timeline that genuinely DIFFERS from real history, with consequences that depart from our actual world.

Judge the DIVERGENCE itself, not writing quality. If it both diverges and is detailed, it is "counterfactual". Choose "recap" only when there is no concrete divergence anywhere in the text.

Return ONLY this JSON: {"verdict":"recap"|"counterfactual","reason":"<one short sentence citing a concrete cue from the text>"}

TEXT:
"""
${scenario}
"""`,
      },
    ],
  };
}

/** Parse the judge's JSON reply; falls back to a keyword scan, else "unknown". */
export function parseVerdict(text: string): { verdict: Verdict; reason: string } {
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const o = JSON.parse(clean) as { verdict?: string; reason?: string };
    const v = String(o.verdict ?? "").toLowerCase();
    if (v === "recap" || v === "counterfactual")
      return { verdict: v, reason: String(o.reason ?? "").trim() };
  } catch {
    /* fall through */
  }
  const low = clean.toLowerCase();
  if (low.includes("counterfactual")) return { verdict: "counterfactual", reason: clean.slice(0, 160) };
  if (low.includes("recap")) return { verdict: "recap", reason: clean.slice(0, 160) };
  return { verdict: "unknown", reason: clean.slice(0, 160) };
}
