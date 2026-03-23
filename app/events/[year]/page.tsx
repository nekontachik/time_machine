import { notFound } from "next/navigation";
import EventsClient from "./EventsClient";
import { generateEvents } from "@/lib/claude";
import { getCachedEvents, setCachedEvents } from "@/lib/redis";
import type { HistoricalEvent } from "@/types";

interface Props {
  params: { year: string };
  searchParams: { lang?: string };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const year = parseInt(params.year, 10);
  const lang = searchParams.lang ?? "ua";

  if (isNaN(year) || year < -3000 || year > 2024) {
    notFound();
  }

  const cached = await getCachedEvents(year, lang);
  const events: HistoricalEvent[] = cached
    ? (cached as HistoricalEvent[])
    : await generateEvents(year, lang).then(async (generated) => {
        await setCachedEvents(year, lang, generated);
        return generated;
      });

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
