/**
 * Eval dimensions for Time Machine (Hamel-style synthetic data generation).
 *
 * A "dimension" is one axis of variation in how the product is used. A "tuple"
 * picks one value from each dimension. We hand-write ~20 tuples that spread
 * across these axes and target our failure hypotheses, then run each tuple
 * through the REAL product pipeline to capture traces for error analysis.
 *
 * Axes (3 — Language is NOT an axis: the product is English-only, see below):
 *   1. Era                 — when in history (stresses data density, anachronism, BCE formatting)
 *   2. Historical Density  — how documented / event-rich the year is (hallucination risk)
 *   3. Counterfactual Complexity — how big/entangled the intervention is
 *
 * ---------------------------------------------------------------------------
 * FIX for the 5 -> 3 events transition (peripheral vs central collapse)
 * ---------------------------------------------------------------------------
 * generateEventTitles now returns exactly 3 events (it used to return 5).
 * If Complexity were defined by *event index* ("disable event #4"), 3 events
 * would no longer support that and peripheral/central would blur together.
 *
 * So Complexity is re-anchored on IMPACT TIER, not index: the model is told to
 * sort events by impact (high -> medium -> low). We define:
 *   - peripheral = disable the LOWEST-impact event (history's spine intact)
 *   - central    = disable the HIGHEST-impact event (large divergence)
 * This keeps peripheral != central even with only 3 events. assertSeparable()
 * below flags the failure case where the 3 events share one impact tier (then
 * the axis really does collapse and that trace should be discarded/re-rolled).
 */
import type { HistoricalEvent, EventToggle, Lang } from "@/types";

// --- 1. Era ----------------------------------------------------------------
export const ERAS = [
  "ancient-bce",
  "classical",
  "medieval",
  "early-modern",
  "industrial",
  "contemporary",
] as const;
export type Era = (typeof ERAS)[number];

export function eraOf(year: number): Era {
  if (year < 0) return "ancient-bce";
  if (year < 500) return "classical";
  if (year < 1500) return "medieval";
  if (year < 1800) return "early-modern";
  if (year < 1946) return "industrial";
  return "contemporary";
}

// --- 2. Historical Density -------------------------------------------------
// A judgment about how richly documented / event-dense a year is. Assigned per
// tuple (cannot be reliably auto-derived). Decoupled from Era on purpose: e.g.
// 44 BCE is ancient yet high-density (Caesar); 1237 is medieval and sparse.
export const DENSITIES = ["high", "medium", "low"] as const;
export type Density = (typeof DENSITIES)[number];

// --- 3. Counterfactual Complexity -----------------------------------------
export const COMPLEXITIES = [
  "none", // nothing toggled off — baseline; does the model still write a counterfactual?
  "peripheral", // disable lowest-impact event — small, contained divergence
  "central", // disable highest-impact event — large divergence
  "compound", // disable two events — entangled cascade
  "custom", // disable highest-impact + a free-text user "what-if" note
] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export const COMPLEXITY_NEEDS_CUSTOM_TEXT: Record<Complexity, boolean> = {
  none: false,
  peripheral: false,
  central: false,
  compound: false,
  custom: true,
};

// --- Language: NOT a dimension ---------------------------------------------
// The product ships in ONE language (English), so language is held CONSTANT,
// not varied. Ukrainian + es/pt/pl existed only as early scaffolding and were
// dropped (see the separate English-only cleanup).
export const PRODUCT_LANG: Lang = "en";

// --- A tuple ---------------------------------------------------------------
export interface Tuple {
  id: string;
  year: number;
  era: Era; // must equal eraOf(year) — validated in tuples.ts
  density: Density;
  complexity: Complexity;
  /** Why this tuple exists — the failure hypothesis it targets. */
  hypothesis: string;
}

// --- impact ranking --------------------------------------------------------
const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

function byImpactDesc(a: HistoricalEvent, b: HistoricalEvent): number {
  const r = (IMPACT_RANK[b.impact] ?? 0) - (IMPACT_RANK[a.impact] ?? 0);
  return r !== 0 ? r : a.id.localeCompare(b.id);
}

/**
 * Given the real generated events and a complexity level, decide which events
 * the simulated user toggles OFF, and produce the EventToggle[] that the API
 * route expects (so buildChangesString yields the production string).
 */
export function selectDisabled(
  events: HistoricalEvent[],
  complexity: Complexity
): { toggles: EventToggle[]; disabledIds: string[] } {
  const ranked = [...events].sort(byImpactDesc);
  let disabled: HistoricalEvent[] = [];

  switch (complexity) {
    case "none":
      disabled = [];
      break;
    case "peripheral":
      disabled = ranked.slice(-1); // lowest impact
      break;
    case "central":
    case "custom":
      disabled = ranked.slice(0, 1); // highest impact
      break;
    case "compound":
      disabled = ranked.slice(0, 2); // two highest
      break;
  }

  const disabledIds = disabled.map((e) => e.id);
  const toggles: EventToggle[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    happened: !disabledIds.includes(e.id),
  }));

  return { toggles, disabledIds };
}

/**
 * The 5->3 guardrail. peripheral vs central only carry distinct meaning if the
 * 3 events span more than one impact tier. Returns false (with a reason) when
 * the axis has collapsed for this particular event set.
 */
export function assertSeparable(events: HistoricalEvent[]): {
  ok: boolean;
  reason?: string;
} {
  const tiers = new Set(events.map((e) => e.impact));
  if (events.length < 2) {
    return { ok: false, reason: `only ${events.length} event(s) generated` };
  }
  if (tiers.size < 2) {
    return {
      ok: false,
      reason: `all ${events.length} events share impact tier "${Array.from(tiers)[0]}" — peripheral/central collapse`,
    };
  }
  return { ok: true };
}
