import { scenarioPrompt, eventTitlesPrompt } from "@/lib/ai/prompts";
import { buildChangesString, NO_CHANGES_SENTINEL } from "@/lib/ai/changes";
import { EVENTS_MODEL, SCENARIO_MODEL } from "@/constants";
import type { EventToggle } from "@/types";

let fail = 0;
const eq = (name: string, got: string, want: string) => {
  if (got !== want) { fail++; console.log(`FAIL ${name}\n--got--\n${got}\n--want--\n${want}`); }
  else console.log(`ok   ${name}`);
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

// events prompt: model/tokens + shape (JSON object with 3 items)
const ep = eventTitlesPrompt(1969, "en");
ok("events.model", ep.model === EVENTS_MODEL && ep.maxTokens > 0);
ok("events.user", ep.messages[1].content.startsWith("Return exactly 3 key events from the year 1969.")
  && ep.messages[1].content.includes('{"events":'));
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
