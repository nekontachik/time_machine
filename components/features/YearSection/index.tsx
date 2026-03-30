"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_YEAR, MAX_YEAR } from "@/constants";
import { formatYear } from "@/lib/formatYear";

const StarField = dynamic(() => import("@/components/layout/StarField"), { ssr: false });

function getEraLabel(year: number): string {
  if (year < -500) return "Ancient World";
  if (year < 500) return "Classical Era";
  if (year < 1400) return "Middle Ages";
  if (year < 1700) return "Renaissance";
  if (year < 1900) return "Industrial Age";
  if (year < 1945) return "World Wars";
  if (year < 1990) return "Cold War";
  return "Modern Era";
}

export default function YearSection() {
  const [year, setYear] = useState(1969);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const displayYear = formatYear(year);
  const eraLabel = getEraLabel(year);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    router.push(`/events/${year}?lang=en`);
  }

  return (
    <div className="relative flex w-full max-w-lg flex-col items-center justify-center">
      {/* Starfield canvas — sits behind everything */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-screen"
        style={{ height: "300px", zIndex: 0 }}
      >
        <StarField year={year} />
      </div>

      {/* Slider UI — on top of canvas */}
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col items-center gap-6 py-8"
        style={{ zIndex: 1 }}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-indigo-400 tracking-widest uppercase mb-2 transition-opacity duration-300">
            {eraLabel}
          </p>
          <span className="text-7xl font-bold tabular-nums text-white drop-shadow-lg">
            {displayYear}
          </span>
        </div>

        <input
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) setYear(val);
          }}
          aria-label="Select historical year"
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-indigo-500"
        />

        <div className="flex w-full justify-between text-xs text-gray-500">
          <span>3000 BC · Ancient World</span>
          <span>2024 · Modern Era</span>
        </div>

        <input
          type="number"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || raw === "-") return; // allow clearing / typing negative
            const val = parseInt(raw, 10);
            if (!isNaN(val)) setYear(Math.max(MIN_YEAR, Math.min(MAX_YEAR, val)));
          }}
          aria-label="Enter year directly"
          className="w-36 rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-2 text-center text-white focus:border-indigo-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading && (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {loading ? "Loading..." : `Travel to ${formatYear(year)}`}
        </button>
      </form>
    </div>
  );
}
