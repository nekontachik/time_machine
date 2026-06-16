/**
 * Builds the "changes" instruction string fed to the scenario model from the
 * user's event toggles. Extracted from app/api/scenario/route.ts so the eval
 * harness builds the exact same string the API does.
 */
import type { EventToggle } from "@/types";

export function buildChangesString(
  events: EventToggle[],
  customText?: string
): string {
  const changedEvents = events
    .filter((e) => !e.happened)
    .map((e) =>
      e.title ? `"${e.title}" did NOT happen` : `event ${e.id} did NOT happen`
    );

  if (customText) changedEvents.push(`Custom note: ${customText}`);

  return changedEvents.length > 0
    ? changedEvents.join("; ")
    : "all events happened as recorded";
}
