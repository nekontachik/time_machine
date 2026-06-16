/**
 * 20 hand-written tuples (Hamel: "Write 20 tuples by hand").
 *
 * Each selects one value per dimension and names the failure hypothesis it
 * targets. They are chosen to (a) spread across Era x Density x Complexity x
 * Language and (b) over-sample our suspected failure modes:
 *   - BCE / sparse years -> hallucinated specifics, anachronism
 *   - complexity "none"  -> model narrates real history instead of a counterfactual
 *   - complexity "compound" -> incoherent / contradictory cascade
 *   - non-English langs  -> English leakage, weaker factual grounding
 *   - "present day 2025 in this timeline" -> model breaks frame, describes our real 2025
 *   - custom what-if text -> ignored or derails the 3-paragraph structure
 *
 * Density is decoupled from Era on purpose (e.g. 44 BCE is ancient yet high
 * density; 1816 is industrial yet low density).
 */
import { eraOf, type Tuple } from "./dimensions";

export const TUPLES: Tuple[] = [
  { id: "T01", year: -44,   era: "ancient-bce",  density: "high",   complexity: "central",    lang: "en", hypothesis: "Canonical central counterfactual (Caesar), high density — control case." },
  { id: "T02", year: -3000, era: "ancient-bce",  density: "low",    complexity: "none",       lang: "en", hypothesis: "Extreme-sparse + none: hallucinated events AND failure to write any counterfactual." },
  { id: "T03", year: -753,  era: "ancient-bce",  density: "medium", complexity: "peripheral", lang: "es", hypothesis: "BCE formatting + low-impact toggle, Spanish grounding." },
  { id: "T04", year: 79,    era: "classical",    density: "high",   complexity: "central",    lang: "ua", hypothesis: "Vesuvius removed, Ukrainian output — anachronism risk in non-EN." },
  { id: "T05", year: 410,   era: "classical",    density: "medium", complexity: "compound",   lang: "en", hypothesis: "Two events removed in classical year — cascade coherence." },
  { id: "T06", year: 313,   era: "classical",    density: "medium", complexity: "custom",     lang: "pt", hypothesis: "Free-text what-if + Portuguese — custom note honored & structure kept." },
  { id: "T07", year: 800,   era: "medieval",     density: "medium", complexity: "peripheral", lang: "pl", hypothesis: "Charlemagne era, Polish, peripheral divergence." },
  { id: "T08", year: 1066,  era: "medieval",     density: "high",   complexity: "central",    lang: "en", hypothesis: "Norman Conquest — canonical central." },
  { id: "T09", year: 1237,  era: "medieval",     density: "low",    complexity: "none",       lang: "ua", hypothesis: "Obscure medieval + none + Ukrainian — hallucination x counterfactual-failure." },
  { id: "T10", year: 1347,  era: "medieval",     density: "high",   complexity: "compound",   lang: "es", hypothesis: "Black Death, compound cascade, Spanish." },
  { id: "T11", year: 1517,  era: "early-modern", density: "high",   complexity: "central",    lang: "en", hypothesis: "Reformation (Luther) removed — central; early-modern boundary." },
  { id: "T12", year: 1648,  era: "early-modern", density: "medium", complexity: "custom",     lang: "en", hypothesis: "Westphalia + custom note — abstract treaty counterfactual." },
  { id: "T13", year: 1755,  era: "early-modern", density: "medium", complexity: "peripheral", lang: "pt", hypothesis: "Lisbon earthquake, peripheral, Portuguese." },
  { id: "T14", year: 1789,  era: "early-modern", density: "high",   complexity: "compound",   lang: "pl", hypothesis: "French Revolution, compound, Polish." },
  { id: "T15", year: 1816,  era: "industrial",   density: "low",    complexity: "central",    lang: "en", hypothesis: "'Year Without a Summer' — obscure but real; central; grounding test." },
  { id: "T16", year: 1914,  era: "industrial",   density: "high",   complexity: "central",    lang: "ua", hypothesis: "WWI outbreak removed, Ukrainian." },
  { id: "T17", year: 1871,  era: "industrial",   density: "medium", complexity: "none",       lang: "es", hypothesis: "Unification year, none, Spanish — does it stay counterfactual?" },
  { id: "T18", year: 1969,  era: "contemporary", density: "high",   complexity: "central",    lang: "en", hypothesis: "Apollo 11 (matches existing harness) — regression anchor." },
  { id: "T19", year: 1989,  era: "contemporary", density: "high",   complexity: "custom",     lang: "en", hypothesis: "Berlin Wall + custom — present-day-2025 frame stress." },
  { id: "T20", year: 1973,  era: "contemporary", density: "medium", complexity: "peripheral", lang: "ua", hypothesis: "Oil crisis, peripheral, Ukrainian." },
];

/** Validate era labels and print a coverage report across all axes. */
export function coverageReport(): string {
  const lines: string[] = [];
  const bad = TUPLES.filter((t) => eraOf(t.year) !== t.era);
  if (bad.length) {
    lines.push(`!! era mismatch: ${bad.map((t) => `${t.id}(${t.year})`).join(", ")}`);
  }
  const tally = (key: keyof Tuple) => {
    const m = new Map<string, number>();
    for (const t of TUPLES) m.set(String(t[key]), (m.get(String(t[key])) ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => `${k}:${v}`).join("  ");
  };
  lines.push(`tuples:      ${TUPLES.length}`);
  lines.push(`era:         ${tally("era")}`);
  lines.push(`density:     ${tally("density")}`);
  lines.push(`complexity:  ${tally("complexity")}`);
  lines.push(`lang:        ${tally("lang")}`);
  return lines.join("\n");
}
