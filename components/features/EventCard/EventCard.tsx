"use client";

import { useState } from "react";
import type { HistoricalEvent } from "@/types";

interface Props {
  event: HistoricalEvent;
  onToggle?: (id: string, happened: boolean) => void;
  happened?: boolean;
  rank?: number;
}

const borderAccent: Record<string, string> = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-yellow-500",
  low: "border-l-4 border-l-blue-400",
};

const badgeColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-blue-400/20 text-blue-400",
};

export default function EventCard({ event, onToggle, happened = true, rank }: Props) {
  const accent = borderAccent[event.impact] ?? borderAccent.medium;
  const badge = badgeColors[event.impact] ?? badgeColors.medium;
  const [imgFailed, setImgFailed] = useState(false);

  const showThumbnail = event.thumbnail && !imgFailed;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200
        hover:scale-[1.01] hover:shadow-xl hover:shadow-black/30
        ${accent}
        ${happened
          ? "border-gray-700 bg-gray-800/60"
          : "border-red-800/50 bg-red-900/10 opacity-70"
        }`}
    >
      {/* Thumbnail — taller for visual impact */}
      {showThumbnail && (
        <div className="relative w-full h-48 overflow-hidden">
          <img
            src={event.thumbnail}
            alt={event.title}
            className="w-full h-full object-cover opacity-90"
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
          {/* Rank overlaid on image */}
          {rank && (
            <span className="absolute top-4 left-5 text-6xl font-black text-white/20 leading-none select-none">
              {String(rank).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      <div className="p-6">
        {/* Rank — only when no thumbnail (or thumbnail failed) */}
        {rank && !showThumbnail && (
          <span className="block text-5xl font-black text-gray-700/50 leading-none mb-3 select-none">
            {String(rank).padStart(2, "0")}
          </span>
        )}

        {/* Title + badge row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-white leading-snug">
            {event.title}
          </h3>
          <span className={`shrink-0 mt-0.5 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${badge}`}>
            {event.impact}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed text-gray-400 mb-4">
          {event.description}
        </p>

        {/* Source links */}
        <div className="flex gap-3 mb-4">
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
              Source ↗
            </a>
          )}
          {event.wikipediaUrl && (
            <a href={event.wikipediaUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              → Wikipedia
            </a>
          )}
        </div>

        {/* Toggle buttons */}
        {onToggle && (
          <div className="flex gap-2">
            <button
              onClick={() => onToggle(event.id, true)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                happened
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
            >
              ✓ Keep it
            </button>
            <button
              onClick={() => onToggle(event.id, false)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                !happened
                  ? "bg-red-700 text-white shadow-lg shadow-red-900/40"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
            >
              ✗ Erase it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
