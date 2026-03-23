import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import EventsClient from "./EventsClient";
import { generateEvents } from "@/lib/ai/text";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import { MOCK_EVENTS } from "@/tests/fixtures/events";
import type { HistoricalEvent } from "@/types";

interface Props {
  params: { year: string };
  searchParams: { lang?: string; e2e_mock?: string };
}

function useE2EMock(searchParams: { e2e_mock?: string }): boolean {
  if (process.env.E2E_MOCK_EVENTS === "true") return true;
  if (searchParams.e2e_mock === "1") return true;
  return cookies().get("e2e_mock_events")?.value === "1";
}

export default async function EventsPage({ params, searchParams }: Props) {
  const year = parseInt(params.year, 10);
  const lang = searchParams.lang ?? "ua";

  if (isNaN(year) || year < -3000 || year > 2024) {
    notFound();
  }

  const useMock = useE2EMock(searchParams);
  let events: HistoricalEvent[];
  if (useMock) {
    events = MOCK_EVENTS;
  } else {
    const cached = await getCachedEvents(year, lang);
    events = cached
      ? (cached as HistoricalEvent[])
      : await generateEvents(year, lang).then(async (generated) => {
          await setCachedEvents(year, lang, generated);
          return generated;
        });
  }

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
