/**
 * Builds the "changes" instruction string fed to the scenario model from the
 * user's event toggles. Extracted from app/api/scenario/route.ts so the eval
 * harness builds the exact same string the API does.
 */
import type { EventToggle } from "@/types";

/** Sentinel returned when the user toggled nothing off. Shared with
 *  scenarioPrompt so it can detect the "no change" case and avoid the
 *  none-recap failure mode (see TAXONOMY.md). */
export const NO_CHANGES_SENTINEL = "all events happened as recorded";

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
