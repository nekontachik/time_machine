"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import EventCard from "@/components/features/EventCard/EventCard";
import type { HistoricalEvent } from "@/types";

interface Props {
  events: HistoricalEvent[];
  year: number;
  lang: string;
}

export default function EventsClient({ events, year, lang }: Props) {
  const t = useTranslations("events");
  // true = happened (default), false = didn't happen
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(events.map((e) => [e.id, true]))
  );
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  const handleToggle = (id: string, happened: boolean) => {
    setToggles((prev) => ({ ...prev, [id]: happened }));
  };

  const anyToggled = Object.values(toggles).some((v) => !v);

  const handleGenerate = () => {
    setGenerating(true);
    const eventsPayload = events.map((e) => ({
      id: e.id,
      happened: toggles[e.id] ?? true,
    }));
    // Pass the title of the first "didn't happen" event so the scenario page
    // can use it in OG meta tags ("Що якби X не сталося?")
    const firstUntoggled = events.find((e) => !(toggles[e.id] ?? true));
    const query = new URLSearchParams({
      year: String(year),
      lang,
      events: JSON.stringify(eventsPayload),
    });
    if (firstUntoggled) {
      query.set("eventTitle", firstUntoggled.title);
    }
    router.push(`/scenario?${query.toString()}`);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            happened={toggles[event.id] ?? true}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {anyToggled && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {generating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span>🚀</span>
            )}
            {generating ? t("generating") : t("generate")}
          </button>
        </div>
      )}
    </>
  );
}
