import type { HistoricalEvent } from "@/types";

/**
 * Shared mock events for E2E and unit tests.
 *
 * Used by:
 * - app/events/[year]/page.tsx when E2E_MOCK_EVENTS=true or cookie e2e_mock_events=1
 * - Unit tests that need a predictable event fixture
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
