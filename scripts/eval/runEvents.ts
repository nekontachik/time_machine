// scripts/eval/runEvents.ts — events-only, для перевірки year-accuracy фіксу
import { eventTitlesPrompt, parseEventTitles, yearLabel } from "@/lib/ai/prompts";
import { callOpenRouter } from "./openrouter";

const FLAGGED = [1237, 1066, 800, -3000];   // де був padding / fuzzy dating
const GOOD    = [-44, 1789, 1969];          // регрес-контроль (мають лишитись 3 правильні)
const RUNS = 5;
const LANG = "en";

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  for (const year of [...FLAGGED, ...GOOD]) {
    for (let r = 1; r <= RUNS; r++) {
      const { text } = await callOpenRouter(eventTitlesPrompt(year, LANG));
      const events = parseEventTitles(text);
      console.log(`\n${yearLabel(year)} r${r} — ${events.length} events:`);
      for (const e of events) console.log(`  [${e.impact}] ${e.title}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });