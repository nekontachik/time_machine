/**
 * Judge-model selection, shared by every judge in scripts/eval/judges/.
 *
 * Self-preference bias is documented: an LLM-as-judge tends to score its own
 * (or same-family) output more favorably. This bias only ever pushes the
 * measured failure rate DOWN — the worst direction, because a falsely-good
 * number is the one nobody goes back to check.
 *
 * Calibration (precision 92.9% / recall 100%, see EVALS.md) was measured
 * with gemini-3.1-flash-lite judging claude-sonnet output — cross-family.
 * A same-family run is not covered by that calibration; its numbers are not
 * comparable to it. So a same-family judge is refused by default, not just
 * discouraged in a comment.
 */
import { SCENARIO_MODEL, EVENTS_MODEL } from "@/constants";

/** Default judge = the existing cross-family model already in the stack
 *  (no new hardcoded literal to drift out of sync with constants/index.ts). */
const DEFAULT_JUDGE_MODEL = EVENTS_MODEL;

const family = (m: string) => m.split("/")[0];

/** Read lazily (at call time) so JUDGE_MODEL works whether set inline on the
 *  command line OR loaded from .env.local by dotenv before the first call. */
export function judgeModel(): string {
  const model = process.env.JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;

  if (family(model) === family(SCENARIO_MODEL) && !process.env.ALLOW_SAME_FAMILY_JUDGE) {
    throw new Error(
      `Judge "${model}" is the same family as generator "${SCENARIO_MODEL}". ` +
        `Calibration (precision 92.9% / recall 100%, see EVALS.md) was measured cross-family — ` +
        `same-family runs are not comparable to it. Set JUDGE_MODEL to a different provider, ` +
        `or ALLOW_SAME_FAMILY_JUDGE=1 to override deliberately (e.g. to measure the bias itself).`
    );
  }
  return model;
}
