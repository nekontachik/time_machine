/**
 * Builds the "changes" instruction string fed to the scenario model from the
 * user's event toggles. Extracted from app/api/scenario/route.ts so the eval
 * harness builds the exact same string the API does.
 */
import type { EventToggle } from "@/types";
import { MAX_EVENTS, MAX_EVENT_TITLE_LEN } from "@/constants";

/** Sentinel returned when the user toggled nothing off. Shared with
 *  scenarioPrompt so it can detect the "no change" case and avoid the
 *  none-recap failure mode (see TAXONOMY.md). */
export const NO_CHANGES_SENTINEL = "all events happened as recorded";

/**
 * Server-side validation of the `events` array from a scenario request, run
 * BEFORE the events are concatenated into the model prompt.
 *
 * Why this exists: the client toggle UI is NOT a trust boundary. An attacker
 * can POST /api/scenario directly with arbitrary event titles, which
 * buildChangesString() splices verbatim into Claude's prompt (the direct
 * prompt-injection surface found in redteam/VULN_TAXONOMY.md). This enforces
 * the request contract and caps payload size. It is defense-in-depth — the
 * model itself already resists these injections in testing — but it removes
 * the "arbitrary unvalidated text into the prompt" gap.
 *
 * Returns an error message, or null when the events are valid.
 */
export function validateScenarioEvents(events: unknown): string | null {
  if (!Array.isArray(events)) return "events must be an array";
  // Note: an empty array is VALID — it is the legitimate "user changed nothing"
  // case (buildChangesString returns NO_CHANGES_SENTINEL). Do not reject it.
  if (events.length > MAX_EVENTS) return `too many events (max ${MAX_EVENTS})`;

  for (const e of events) {
    if (typeof e !== "object" || e === null) return "each event must be an object";
    const ev = e as Record<string, unknown>;
    if (typeof ev.id !== "string") return "event.id must be a string";
    if (typeof ev.happened !== "boolean") return "event.happened must be a boolean";
    if (ev.title !== undefined) {
      if (typeof ev.title !== "string") return "event.title must be a string";
      if (ev.title.length > MAX_EVENT_TITLE_LEN)
        return `event.title too long (max ${MAX_EVENT_TITLE_LEN})`;
    }
  }
  return null;
}

export function buildChangesString(events: EventToggle[]): string {
  const changedEvents = events
    .filter((e) => !e.happened)
    .map((e) =>
      e.title ? `"${e.title}" did NOT happen` : `event ${e.id} did NOT happen`
    );

  return changedEvents.length > 0
    ? changedEvents.join("; ")
    : NO_CHANGES_SENTINEL;
}
