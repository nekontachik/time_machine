"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScenarioRequest } from "@/types";

interface Props {
  request?: ScenarioRequest;
}


export default function ScenarioStream({ request }: Props) {
  const t = useTranslations("scenario");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef("");

  const requestKey = request ? JSON.stringify(request) : null;

  // Reset image when request changes
  useEffect(() => {
    setImageUrl(null);
    textRef.current = "";
  }, [requestKey]);

  useEffect(() => {
    if (!requestKey) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let ignore = false;

    setLoading(true);
    setText("");
    setError(null);
    textRef.current = "";

    (async () => {
      try {
        const res = await fetch("/api/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestKey,
          signal: controller.signal,
        });

        if (ignore) return;
        if (!res.ok) throw new Error(await res.text());

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (ignore) { reader.cancel(); break; }
          const chunk = decoder.decode(value, { stream: true });
          textRef.current += chunk;
          setText((prev) => prev + chunk);
        }
      } catch (err) {
        if (!ignore && (err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          // Fetch image after text streaming completes
          if (textRef.current && request?.year) {
            const summary = textRef.current.slice(0, 400);
            fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scenarioSummary: summary, year: request.year, style: "cinematic" }),
            })
              .then((r) => r.ok ? r.json() : null)
              .then((data) => { if (!ignore && data?.imageUrl) setImageUrl(data.imageUrl); })
              .catch(() => {/* silently ignore image errors */});
          }
        }
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-red-300">
        {t("errorPrefix")} {error}
      </div>
    );
  }

  // Skeleton loader — before first text chunk arrives
  if (loading && !text) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          {t("generating")}
        </p>
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6 space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-700" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-700" />
        </div>
      </div>
    );
  }

  if (!text && !loading) {
    return <p className="text-gray-500">{t("placeholder")}</p>;
  }

  const stripped = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1");

  return (
    <div className="space-y-6">
      {/* Image — only rendered when a real (non-placeholder) URL is ready */}
      {imageUrl && !imageUrl.startsWith("/placeholder") && (
        <img
          src={imageUrl}
          alt={`Alternative history ${request?.year ?? ""}`}
          className="w-full rounded-xl border border-gray-700 object-cover animate-fade-in"
        />
      )}

      {/* Scenario text */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6">
        {loading && (
          <p className="mb-3 flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            {t("generating")}
          </p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed text-gray-200">
          {stripped}
          {loading && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-blink bg-indigo-400" />
          )}
        </p>
      </div>
    </div>
  );
}
