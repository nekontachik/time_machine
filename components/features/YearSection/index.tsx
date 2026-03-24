"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_YEAR, MAX_YEAR } from "@/constants";

const StarField = dynamic(() => import("@/components/layout/StarField"), { ssr: false });

export default function YearSection() {
  const [year, setYear] = useState(1969);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const displayYear = year.toString();

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
          <span className="text-7xl font-bold tabular-nums text-white drop-shadow-lg">
            {displayYear}
          </span>
        </div>

        <input
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-indigo-500"
        />

        <div className="flex w-full justify-between text-xs text-gray-400">
          <span>-3000</span>
          <span>2024</span>
        </div>

        <input
          type="number"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
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
          {loading ? "Loading..." : "View Events"}
        </button>
      </form>
    </div>
  );
}
