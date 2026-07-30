import type { HistoricalEvent } from "@/types";

/**
 * Shared mock events.
 *
 * Used by:
 * - app/events/[year]/page.tsx when E2E_MOCK_EVENTS=true or cookie e2e_mock_events=1
 *   (production-runtime fallback for E2E tests)
 * - Unit/E2E tests that need a predictable event fixture
 *
 * Lives in lib/ rather than tests/ so production code never imports from
 * the tests/ tree (which would otherwise drag test-only modules into the
 * Next.js production bundle).
 */
export const MOCK_EVENTS: HistoricalEvent[] = [
  {
    id: "1",
    title: "Moon Landing",
    description: "First human on the moon",
    impact: "high",
  },
  {
    id: "2",
    title: "Woodstock Festival",
    description: "Iconic music festival",
    impact: "medium",
  },
  {
    id: "3",
    title: "ARPANET",
    description: "First message on the internet",
    impact: "high",
  },
  {
    id: "4",
    title: "Concorde Flight",
    description: "First commercial supersonic passenger flight",
    impact: "medium",
  },
  {
    id: "5",
    title: "Stonewall Riots",
    description: "Uprising that sparked the modern LGBTQ rights movement",
    impact: "low",
  },
];
