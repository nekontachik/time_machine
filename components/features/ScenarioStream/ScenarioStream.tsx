"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ScenarioRequest } from "@/types";

interface Props {
  request?: ScenarioRequest;
}

type VideoStatus = "idle" | "pending" | "processing" | "completed" | "failed";

const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_MAX_POLLS = 30; // 90 s timeout

export default function ScenarioStream({ request }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef("");

  // ── Video state ──────────────────────────────────────────────────────────
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const requestKey = request ? JSON.stringify(request) : null;

  // Reset everything when request changes
  useEffect(() => {
    setImageUrl(null);
    textRef.current = "";
    setVideoStatus("idle");
    setVideoUrl(null);
    setVideoError(null);
    pollCountRef.current = 0;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, [requestKey]);

  // ── Video polling ────────────────────────────────────────────────────────
  const pollVideo = useCallback((taskId: string) => {
    if (pollCountRef.current >= VIDEO_MAX_POLLS) {
      setVideoStatus("failed");
      setVideoError("Video generation timed out.");
      return;
    }
    pollCountRef.current += 1;

    pollTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/video/status?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json() as { status: string; videoUrl?: string; error?: string };

        if (data.status === "completed" && data.videoUrl) {
          setVideoStatus("completed");
          setVideoUrl(data.videoUrl);
        } else if (data.status === "failed") {
          setVideoStatus("failed");
          setVideoError(data.error ?? "Video generation failed.");
        } else {
          setVideoStatus(data.status === "pending" ? "pending" : "processing");
          pollVideo(taskId);
        }
      } catch {
        setVideoStatus("failed");
        setVideoError("Failed to check video status.");
      }
    }, VIDEO_POLL_INTERVAL_MS);
  }, []);

  // ── Generate video ───────────────────────────────────────────────────────
  async function handleGenerateVideo() {
    if (!imageUrl) return;

    setVideoStatus("pending");
    setVideoUrl(null);
    setVideoError(null);
    pollCountRef.current = 0;

    const prompt = textRef.current
      ? `Cinematic motion: ${textRef.current.slice(0, 200).replace(/\n/g, " ")}`
      : "Slow cinematic camera movement, dramatic lighting, epic historical scene.";

    try {
      const res = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, prompt, duration: 5 }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { taskId: string; status: string };
      pollVideo(data.taskId);
    } catch (err) {
      setVideoStatus("failed");
      setVideoError((err as Error).message);
    }
  }

  // ── Scenario streaming ───────────────────────────────────────────────────
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
          if (textRef.current && request?.year) {
            const summary = textRef.current.slice(0, 400);
            fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scenarioSummary: summary, year: request.year, style: "cinematic" }),
            })
              .then((r) => r.ok ? r.json() : null)
              .then((data) => {
                const d = data as { imageUrl?: string } | null;
                if (!ignore && d?.imageUrl) setImageUrl(d.imageUrl);
              })
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
        Error: {error}
      </div>
    );
  }

  if (loading && !text) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          Generating history
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
    return <p className="text-gray-500">Select events and click &quot;Generate Scenario&quot;.</p>;
  }

  const stripped = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1");

  return (
    <div className="space-y-6">
      {/* Generated image + video controls */}
      {imageUrl && !imageUrl.startsWith("/placeholder") && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Alternative history ${request?.year ?? ""}`}
            className="w-full rounded-xl border border-gray-700 object-cover animate-fade-in"
          />

          {videoStatus === "idle" && (
            <button
              onClick={handleGenerateVideo}
              className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors"
            >
              <span>🎬</span> Generate Video
            </button>
          )}

          {(videoStatus === "pending" || videoStatus === "processing") && (
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              {videoStatus === "pending" ? "Starting video generation…" : "Rendering video…"}
            </p>
          )}

          {videoStatus === "failed" && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-400">{videoError ?? "Video generation failed."}</p>
              <button
                onClick={handleGenerateVideo}
                className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600"
              >
                Retry
              </button>
            </div>
          )}

          {videoStatus === "completed" && videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-xl border border-gray-700"
            />
          )}
        </div>
      )}

      {/* Scenario text */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6">
        {loading && (
          <p className="mb-3 flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            Generating history
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
