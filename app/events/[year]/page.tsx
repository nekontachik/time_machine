import { notFound } from "next/navigation";
import EventsClient from "./EventsClient";
import type { HistoricalEvent } from "@/types";

interface Props {
  params: { year: string };
  searchParams: { lang?: string };
}

async function getEvents(year: number, lang: string): Promise<HistoricalEvent[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/historical-events?year=${year}&lang=${lang}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch events");
  const data = await res.json();
  return data.events as HistoricalEvent[];
}

export default async function EventsPage({ params, searchParams }: Props) {
  const year = parseInt(params.year, 10);
  const lang = searchParams.lang ?? "ua";

  if (isNaN(year) || year < -3000 || year > 2024) {
    notFound();
  }

  const events = await getEvents(year, lang);

  const isEn = lang === "en";
  const bce = isEn ? "BCE" : "до н.е.";
  const yearSuffix = isEn ? "" : " рік";
  const displayYear = year < 0 ? `${Math.abs(year)} ${bce}` : String(year);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h2 className="mb-8 text-3xl font-bold text-white">
        {displayYear}{yearSuffix}
      </h2>
      <EventsClient events={events} year={year} lang={lang} />
    </main>
  );
}
