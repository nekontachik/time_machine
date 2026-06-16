import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import EventsClient from "./EventsClient";
import { generateEvents } from "@/lib/ai/text";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import { MOCK_EVENTS } from "@/tests/fixtures/events";
import type { HistoricalEvent } from "@/types";
import { formatYear } from "@/lib/formatYear";

interface Props {
  params: { year: string };
  searchParams: { lang?: string; e2e_mock?: string };
}

function checkE2EMock(searchParams: { e2e_mock?: string }): boolean {
  if (process.env.E2E_MOCK_EVENTS === "true") return true;
  if (searchParams.e2e_mock === "1") return true;
  return cookies().get("e2e_mock_events")?.value === "1";
}

export default async function EventsPage({ params, searchParams }: Props) {
  const year = parseInt(params.year, 10);
  const lang = searchParams.lang ?? "en";

  if (isNaN(year) || year < -3000 || year > 2024) {
    notFound();
  }

  const useMock = checkE2EMock(searchParams);
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

  const backLabel = "Choose another year";

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← {backLabel}
      </Link>
      <h2 className="mb-8 text-3xl font-bold text-white">
        {formatYear(year)}
      </h2>
      <EventsClient events={events} year={year} lang={lang} />
    </main>
  );
}
