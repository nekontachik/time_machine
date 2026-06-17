/** The product ships in English only. */
export type Lang = "en";

export type ImpactLevel = "high" | "medium" | "low";

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  wikipediaUrl?: string;
  thumbnail?: string;
  sourceUrl?: string;
}

export interface EventToggle {
  id: string;
  happened: boolean;
  title?: string;
}

export interface PremiumOptions {
  country: string;
  city: string;
}

export interface ScenarioRequest {
  year: number;
  events: EventToggle[];
  lang: Lang;
  premium?: PremiumOptions;
}

export interface EventsResponse {
  year: number;
  events: HistoricalEvent[];
}

export interface ImageRequest {
  scenarioSummary: string;
  year: number;
  style?: "cinematic" | "painterly" | "sketch";
}

export interface ImageResponse {
  imageUrl: string;
}
