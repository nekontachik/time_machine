/**
 * Two-step naturalization (Hamel: "Convert tuples to queries" in a SEPARATE
 * prompt to avoid repetitive phrasing).
 *
 * Time Machine's input is mostly structured (year + which events the user
 * toggled off + language). The only free-text input is the optional "custom
 * note" a user can attach. So naturalization here produces a realistic custom
 * what-if note for "custom"-complexity tuples:
 *
 *   Step 3a (draft):  given the year + real events + which one was removed,
 *                     write a plausible user note in the target language.
 *   Step 3b (clean):  a SECOND prompt critiques and rewrites the draft so it
 *                     sounds like a real curious person, not a template.
 *
 * Non-custom tuples send no custom note (the common real-world case: users just
 * toggle events), so they are skipped here.
 */
import type { HistoricalEvent, Lang } from "@/types";
import { yearLabel } from "@/lib/ai/prompts";
import { callOpenRouter } from "./openrouter";
import { EVENTS_MODEL } from "@/constants";

// Loose map (not Record<Lang>) so the harness stays decoupled from the exact
// Lang union — the product may narrow Lang to just "en" without breaking this.
const LANG_NAME: Record<string, string> = {
  en: "English",
  ua: "Ukrainian",
  es: "Spanish",
  pt: "Portuguese",
  pl: "Polish",
};

export async function draftCustomText(
  year: number,
  events: HistoricalEvent[],
  removed: HistoricalEvent[],
  lang: Lang
): Promise<string> {
  const removedTitles = removed.map((e) => e.title).join(", ") || "(none)";
  const eventList = events.map((e) => `- ${e.title} [${e.impact}]`).join("\n");

  const { text } = await callOpenRouter({
    model: EVENTS_MODEL,
    maxTokens: 120,
    messages: [
      {
        role: "system",
        content:
          "You role-play an ordinary, curious user of an alternate-history app. You are NOT a historian.",
      },
      {
        role: "user",
        content: `Year ${yearLabel(year)}. The app shows these events:
${eventList}
The user has removed: ${removedTitles}.
Write the short free-text "what if" note this user would type to steer the story — one or two sentences, first person, casual, specific. Language: ${(LANG_NAME[lang] ?? "English")}. Output ONLY the note, no quotes.`,
      },
    ],
  });
  return text.trim().replace(/^["']|["']$/g, "");
}

export async function cleanCustomText(draft: string, lang: Lang): Promise<string> {
  const { text } = await callOpenRouter({
    model: EVENTS_MODEL,
    maxTokens: 120,
    messages: [
      {
        role: "system",
        content:
          "You edit text so it reads like a real person typed it quickly: natural, concrete, no AI-assistant phrasing, no hedging, no meta-commentary.",
      },
      {
        role: "user",
        content: `Rewrite this user note so it sounds authentically human (keep the meaning and the language ${(LANG_NAME[lang] ?? "English")}). Remove any robotic or templated phrasing. Output ONLY the rewritten note:\n\n${draft}`,
      },
    ],
  });
  return text.trim().replace(/^["']|["']$/g, "");
}

export async function naturalizeCustomText(
  year: number,
  events: HistoricalEvent[],
  removed: HistoricalEvent[],
  lang: Lang
): Promise<{ draft: string; clean: string }> {
  const draft = await draftCustomText(year, events, removed, lang);
  const clean = await cleanCustomText(draft, lang);
  return { draft, clean };
}
