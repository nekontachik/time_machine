/**
 * Prompt parity guard — the evidence behind "the harness traces are real"
 * (scripts/eval/README.md, "Faithfulness"). It pins the PRODUCTION prompts that
 * runTraces.ts sends, so a prompt edit cannot silently change what the eval
 * harness measures.
 *
 *   npm run eval:parity
 *
 * Byte-for-byte assertions use eq(); ok() is only for shape/flag checks that
 * have no single canonical string. Prefer eq() — a prefix or substring check
 * pins one line and rots quietly, which is exactly how the events prompt drifted
 * (v0 "Return exactly 3…" → v2 "Return up to 3…") without anyone noticing.
 *
 * SCOPE: product prompts only. The JUDGE prompt is pinned separately, and more
 * strictly, by scripts/eval/deepeval/test_prompt_source_parity.py — it parses
 * payoffJudge.ts source and byte-compares it to the Python port across four
 * years. Do not duplicate that here.
 */
import { scenarioPrompt, eventTitlesPrompt } from "@/lib/ai/prompts";
import { buildChangesString, NO_CHANGES_SENTINEL } from "@/lib/ai/changes";
import { EVENTS_MODEL, SCENARIO_MODEL } from "@/constants";
import type { EventToggle } from "@/types";

let fail = 0;
/** Byte-for-byte. On mismatch, print the first differing offset — a 900-char
 *  diff of two near-identical prompts is unreadable without it. */
const eq = (name: string, got: string, want: string) => {
  if (got === want) { console.log(`ok   ${name}`); return; }
  fail++;
  let i = 0;
  while (i < got.length && i < want.length && got[i] === want[i]) i++;
  console.log(
    `FAIL ${name}\n  first difference at char ${i}\n` +
      `  got : …${JSON.stringify(got.slice(Math.max(0, i - 30), i + 40))}\n` +
      `  want: …${JSON.stringify(want.slice(Math.max(0, i - 30), i + 40))}\n` +
      `  (lengths: got ${got.length}, want ${want.length})`
  );
};
const ok = (name: string, cond: boolean) =>
  console.log(cond ? `ok   ${name}` : (fail++, `FAIL ${name}`));

// --- scenario prompt (CHANGED branch): user content byte-for-byte ---
const year = 1969, changes = "Apollo 11 fails", lang = "en";
const wantUser = `Year: ${year}. Changed events: ${changes}.

Write an alternative history in exactly 3 paragraphs. Output language: ${lang}.

Paragraph 1 — The Divergence (immediate, weeks to months after the change):
Describe the precise moment the timeline splits. Name specific people, institutions, and places. Show the first concrete consequence that nobody expected.

Paragraph 2 — The Cascade (1–20 years later):
Follow the butterfly effect. What alliances shift? Which technologies accelerate or stall? Name a city that rose or fell, a leader who gained power or was never born, a war that did or didn't happen.

Paragraph 3 — The World Today (present day, 2025 in this timeline):
Describe how the world looks now. What does the average person's life feel like? What exists that doesn't in our timeline — or what is missing that we take for granted? End with one haunting detail.

Start immediately with Paragraph 1. No preamble, no headers, no markdown.`;
const sp = scenarioPrompt({ year, changes, lang });
eq("scenario.system", sp.messages[0].content, "You are a literary alternative history writer in the tradition of Robert Cowley and Harry Turtledove. Write with cinematic specificity: real names, exact dates, concrete places.");
eq("scenario.user(no-premium)", sp.messages[1].content, wantUser);
ok("scenario.model", sp.model === SCENARIO_MODEL && sp.maxTokens > 0);

// premium localContext inserted in the right spot
const spp = scenarioPrompt({ year, changes, lang, premium: { city: "Kyiv", country: "Ukraine" } });
ok("scenario.premium-localContext",
  spp.messages[1].content.includes("we take for granted? Focus on impact on Kyiv, Ukraine. End with one haunting detail."));

// NONE branch: must instruct a divergence, NOT restate "Changed events" (anti none-recap)
const spNone = scenarioPrompt({ year, changes: NO_CHANGES_SENTINEL, lang });
ok("scenario.none-diverges",
  !spNone.messages[1].content.includes("Changed events:") &&
  /counterfactual|do NOT retell/i.test(spNone.messages[1].content));

// --- events prompt: user content byte-for-byte ---
// This used to be a startsWith() on "Return exactly 3 key events…". The v2
// year-accuracy prompt (fix-01-recall-regression.md) changed that opening to
// "Return up to 3…" and shipped to lib/ai/prompts.ts, but the assertion was
// never updated — so the guard sat red and, because nothing ran it, nobody
// noticed. A prefix check would have gone stale the same way again: it only
// pins the first line. Pin the whole thing.
const wantEventsUser = `Return up to 3 key events from the year 1969.

Year accuracy is the one hard rule:
- Include ONLY events that actually occurred in 1969.
- Include EVERY event you are confident happened in 1969, up to a maximum of 3 — do NOT withhold correct events, and prefer 3 when three genuine 1969 events exist.
- NEVER add an event from a different year to reach three. If fewer than 3 notable events occurred in 1969, return only those.
- If you are unsure whether an event happened in exactly 1969, leave it out.

Other rules (never at the expense of the hard rule):
- Cover diverse domains (politics, science/tech, culture, military, social/economic) when several genuine same-year events exist.
- Each description: 2–3 sentences — what happened, why it mattered, what it changed.
- Include a specific month/day ONLY when it is actually known for that event; never invent precision. For deep antiquity where exact dating is impossible, state the timing approximately (e.g., "around this time") rather than a false exact date.
- Impact: "high" = shaped a decade or more; "medium" = notable regional/global effect; "low" = limited direct consequence.
- Sort by impact descending.
- Output language: en.

Return a JSON object {"events":[{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]} with up to 3 items, every one genuinely from 1969.`;
const ep = eventTitlesPrompt(1969, "en");
eq("events.system", ep.messages[0].content, "You are a meticulous historian and science communicator. Return only valid JSON, no markdown.");
eq("events.user", ep.messages[1].content, wantEventsUser);
ok("events.model", ep.model === EVENTS_MODEL && ep.maxTokens > 0);
const epBce = eventTitlesPrompt(-44, "en");
ok("events.bce-label", epBce.messages[1].content.includes("from the year 44 BCE."));

// --- buildChangesString ---
const t = (id: string, happened: boolean, title?: string): EventToggle => ({ id, happened, title });
eq("changes.none", buildChangesString([t("1", true, "A"), t("2", true, "B")]), NO_CHANGES_SENTINEL);
eq("changes.one-title", buildChangesString([t("1", false, "Moon landing"), t("2", true, "B")]), '"Moon landing" did NOT happen');
eq("changes.no-title", buildChangesString([t("3", false)]), "event 3 did NOT happen");
eq("changes.two", buildChangesString([t("1", false, "A"), t("2", false, "B")]), '"A" did NOT happen; "B" did NOT happen');

console.log(fail === 0 ? "\nALL PARITY CHECKS PASSED" : `\n${fail} PARITY FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
