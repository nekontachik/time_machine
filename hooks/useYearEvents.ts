"use client";

import { useEffect, useState } from "react";
import type { HistoricalEvent, Lang } from "@/types";

interface State {
  events: HistoricalEvent[];
  loading: boolean;
  error: string | null;
}

export function useYearEvents(year: number | null, lang: Lang = "ua"): State {
  const [state, setState] = useState<State>({
    events: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (year === null) return;

    const controller = new AbortController();
    setState({ events: [], loading: true, error: null });

    fetch(`/api/events?year=${year}&lang=${lang}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load events");
        return res.json();
      })
      .then((data) => {
        setState({ events: data.events, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setState({ events: [], loading: false, error: err.message });
        }
      });

    return () => controller.abort();
  }, [year, lang]);

  return state;
}
