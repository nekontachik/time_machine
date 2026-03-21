"use client";

import { useTranslations } from "next-intl";
import type { HistoricalEvent } from "@/types";

interface Props {
  event: HistoricalEvent;
  onToggle?: (id: string, happened: boolean) => void;
  happened?: boolean;
}

const impactColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  low: "bg-green-500/20 text-green-300 border-green-500/30",
};

export default function EventCard({ event, onToggle, happened = true }: Props) {
  const t = useTranslations("events");

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        happened
          ? "border-gray-700 bg-gray-800/60"
          : "border-red-800/50 bg-red-900/10 opacity-70"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{event.title}</h3>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${
            impactColors[event.impact] ?? impactColors.medium
          }`}
        >
          {event.impact}
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        {event.description}
      </p>
      {onToggle && (
        <div className="flex gap-2">
          <button
            onClick={() => onToggle(event.id, true)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              happened
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {t("happened")}
          </button>
          <button
            onClick={() => onToggle(event.id, false)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              !happened
                ? "bg-red-700 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {t("didNotHappen")}
          </button>
        </div>
      )}
    </div>
  );
}
