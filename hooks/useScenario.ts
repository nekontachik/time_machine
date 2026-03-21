"use client";

import { useCallback, useRef, useState } from "react";
import type { ScenarioRequest } from "@/types";

interface State {
  text: string;
  loading: boolean;
  error: string | null;
}

export function useScenario() {
  const [state, setState] = useState<State>({
    text: "",
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (request: ScenarioRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ text: "", loading: true, error: null });

    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setState((prev) => ({
          ...prev,
          text: prev.text + decoder.decode(value, { stream: true }),
        }));
      }
      setState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState({ text: "", loading: false, error: (err as Error).message });
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, loading: false }));
  }, []);

  return { ...state, generate, cancel };
}
