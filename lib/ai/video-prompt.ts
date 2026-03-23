/**
 * Motion prompt generator for Kling AI image-to-video.
 *
 * Kling performs best with SHORT, motion-focused descriptions (under 50 words).
 * These prompts describe CAMERA MOVEMENT and SCENE DYNAMICS — not story content.
 * The scenario context is used to pick the most fitting template variant.
 */

// ---------------------------------------------------------------------------
// Scenario type detection
// ---------------------------------------------------------------------------

type ScenarioType =
  | "prevented_disaster"
  | "changed_invention"
  | "altered_politics"
  | "different_discovery"
  | "personal_choice";

const DISASTER_KEYWORDS = [
  "war", "bomb", "attack", "collapse", "flood", "earthquake", "plague",
  "epidemic", "fire", "explosion", "genocide", "famine", "catastrophe",
  "conflict", "revolution", "coup",
];

const INVENTION_KEYWORDS = [
  "invent", "device", "machine", "engine", "technology", "computer",
  "electricity", "telephone", "internet", "patent", "discovery", "radio",
  "aircraft", "rocket", "nuclear",
];

const POLITICS_KEYWORDS = [
  "election", "president", "king", "emperor", "government", "treaty",
  "independence", "empire", "democracy", "republic", "parliament",
  "law", "policy", "constitution", "alliance",
];

const DISCOVERY_KEYWORDS = [
  "discover", "explore", "expedition", "continent", "planet", "species",
  "cure", "vaccine", "gene", "atom", "bacteria", "virus", "element",
  "fossil", "ruins", "artifact",
];

function detectScenarioType(
  event: string,
  alternativeScenario: string
): ScenarioType {
  const text = `${event} ${alternativeScenario}`.toLowerCase();

  const score = (keywords: string[]) =>
    keywords.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);

  const scores: Record<ScenarioType, number> = {
    prevented_disaster: score(DISASTER_KEYWORDS),
    changed_invention: score(INVENTION_KEYWORDS),
    altered_politics: score(POLITICS_KEYWORDS),
    different_discovery: score(DISCOVERY_KEYWORDS),
    personal_choice: 0, // fallback
  };

  const best = (Object.keys(scores) as ScenarioType[]).reduce((a, b) =>
    scores[a] >= scores[b] ? a : b
  );

  // Only use detected type if at least one keyword matched
  return scores[best] > 0 ? best : "personal_choice";
}

// ---------------------------------------------------------------------------
// Motion templates (5 variants, one per scenario type)
// ---------------------------------------------------------------------------

const MOTION_TEMPLATES: Record<ScenarioType, string> = {
  prevented_disaster:
    "Camera slowly pulls back revealing a transformed city skyline, people celebrating in streets, flags waving in wind",

  changed_invention:
    "Slow zoom into glowing machinery, gears turning, sparks flying, time-lapse of a workshop filling with inventors",

  altered_politics:
    "Wide aerial pan over grand ceremonial hall, crowds gathering below, banners unfurling in slow motion",

  different_discovery:
    "Tracking shot through dense jungle or deep space, dramatic spotlight on newly revealed landscape, dust particles drifting",

  personal_choice:
    "Time-lapse of overgrown ruins, nature reclaiming abandoned buildings, dramatic storm clouds gathering on horizon",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a short motion-focused prompt (max 50 words) for Kling image-to-video.
 *
 * @param event               - Title or description of the historical event
 * @param alternativeScenario - The alternative history narrative (used for type detection)
 * @param year                - The historical year (used to append era context)
 * @returns A motion prompt string suitable for Kling AI
 */
export function buildMotionPrompt(
  event: string,
  alternativeScenario: string,
  year: number
): string {
  const scenarioType = detectScenarioType(event, alternativeScenario);
  const base = MOTION_TEMPLATES[scenarioType];

  // Append a short era tag so the model keeps cinematography period-appropriate
  const era =
    year < 0
      ? `ancient world ${Math.abs(year)} BCE`
      : year < 1000
      ? `medieval era ${year} CE`
      : year < 1800
      ? `early modern period ${year}`
      : `${year}`;

  const prompt = `${base}, set in ${era}`;

  // Hard cap at 50 words to stay within Kling's sweet spot
  const words = prompt.split(/\s+/);
  return words.length <= 50 ? prompt : words.slice(0, 50).join(" ");
}

/**
 * Expose the scenario type detector for testing and UI hints.
 */
export { detectScenarioType };
export type { ScenarioType };
