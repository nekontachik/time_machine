"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EventCard from "@/components/features/EventCard/EventCard";
import type { HistoricalEvent } from "@/types";

interface Props {
  events: HistoricalEvent[];
  year: number;
  lang: string;
}

type Step = "year-reveal" | "events-reveal" | "choice";

// Year reveal overlay shows for this many ms before fading out
const YEAR_REVEAL_MS = 1600;
// Stagger delay between each card appearing
const CARD_STAGGER_MS = 400;

export default function EventsClient({ events, year, lang }: Props) {
  const [step, setStep] = useState<Step>("year-reveal");
  const [visibleCount, setVisibleCount] = useState(0);
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(events.map((e) => [e.id, true]))
  );
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  // Step machine: year-reveal → events-reveal → choice
  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setStep("events-reveal");

      // Stagger each card in
      events.forEach((_, i) => {
        setTimeout(() => {
          setVisibleCount(i + 1);
          if (i === events.length - 1) {
            setStep("choice");
          }
        }, i * CARD_STAGGER_MS);
      });
    }, YEAR_REVEAL_MS);

    return () => clearTimeout(revealTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = (id: string, happened: boolean) => {
    setToggles((prev) => ({ ...prev, [id]: happened }));
  };

  const anyToggled = Object.values(toggles).some((v) => !v);

  const handleGenerate = () => {
    setGenerating(true);
    const eventsPayload = events.map((e) => ({
      id: e.id,
      happened: toggles[e.id] ?? true,
      title: e.title,
    }));
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
      {/* ── Year reveal overlay ─────────────────────────────────────────── */}
      {step === "year-reveal" && (
        <div className="era-grain relative mb-8 flex items-center justify-center rounded-2xl bg-gray-900/80 py-12 animate-fade-in">
          <span className="text-8xl font-black tracking-tight text-white animate-year-pop">
            {year < 0 ? `${Math.abs(year)} BCE` : year}
          </span>
        </div>
      )}

      {/* ── Event cards (staggered reveal) ──────────────────────────────── */}
      {step !== "year-reveal" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400 mb-4 text-right">
            {events.filter((e) => toggles[e.id] !== true).length} of {events.length} events reviewed
          </p>
          {events.map((event, i) => (
            <div
              key={event.id}
              className={i < visibleCount ? "animate-reveal-card" : "opacity-0"}
              style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
            >
              <EventCard
                event={event}
                rank={i + 1}
                happened={toggles[event.id] ?? true}
                onToggle={step === "choice" ? handleToggle : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Hint + Generate button (only once all cards are visible) ──── */}
      {step === "choice" && (
        <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in">
          {!anyToggled ? (
            <p className="text-sm text-gray-400 text-center px-4">
              👆 Tap <span className="font-medium text-red-400">&quot;Erase it&quot;</span> on at least one event to create an alternative history scenario
            </p>
          ) : (
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
              {generating ? "Generating..." : "Generate Scenario"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
