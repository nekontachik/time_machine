import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import EventsClient from "./EventsClient";
import { generateEvents } from "@/lib/ai/text";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import {
  checkBucketLimit,
  getClientIpFromHeaders,
} from "@/lib/infrastructure/rate-limit";
import { MOCK_EVENTS } from "@/lib/mocks/events";
import { LangSchema } from "@/lib/validators";
import type { HistoricalEvent, Lang } from "@/types";
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

  // `lang` is attacker-controlled and reaches TWO sensitive sinks: the Redis
  // cache key (lib/infrastructure/cache.ts) and the LLM prompt
  // (lib/ai/prompts.ts). Left free-form it allows (a) unbounded cache-key
  // cardinality — every unique value is a guaranteed cache miss that costs a
  // paid OpenRouter + Tavily round-trip and leaves a 24h Redis key — and
  // (b) prompt injection via ?lang=en.%20Ignore%20all%20previous%20instructions.
  // /api/historical-events already enum-validates this; the SSR page is the
  // same pipeline and needs the same guard. Fall back to the default rather
  // than 404 so an unknown locale still renders.
  const langParsed = LangSchema.safeParse(searchParams.lang ?? "en");
  const lang: Lang = langParsed.success ? langParsed.data : "en";

  if (isNaN(year) || year < -3000 || year > 2024) {
    notFound();
  }

  const useMock = checkE2EMock(searchParams);
  let events: HistoricalEvent[];
  if (useMock) {
    events = MOCK_EVENTS;
  } else {
    const cached = await getCachedEvents(year, lang);
    if (cached) {
      events = cached as HistoricalEvent[];
    } else {
      // Cache miss → about to make a paid API call. Apply rate-limit so
      // attackers cannot bypass the API rate-limit by hitting the SSR
      // page directly with random lang values.
      const ip = getClientIpFromHeaders(headers());
      const { allowed } = await checkBucketLimit(ip, "events");
      if (!allowed) {
        // Surface as 429-equivalent through notFound() so we don't leak
        // rate-limit state in the URL. A nicer UX would show a "try again
        // tomorrow" page — out of scope here.
        notFound();
      }
      const generated = await generateEvents(year, lang);
      await setCachedEvents(year, lang, generated);
      events = generated;
    }
  }

  const backLabel = lang === "en" ? "Choose another year" : "Обрати інший рік";

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
