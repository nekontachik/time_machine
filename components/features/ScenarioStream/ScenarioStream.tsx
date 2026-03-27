"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ScenarioRequest } from "@/types";

// ── Scroll progress hook (0 → 1) ─────────────────────────────────────────────
function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}

// ── Paragraph with viewport-reveal animation ─────────────────────────────────
function RevealParagraph({ children }: { children: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <p
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        willChange: "opacity, transform",
      }}
      className="leading-relaxed text-gray-200 whitespace-pre-wrap"
    >
      {children}
    </p>
  );
}

// ── Image with blur-to-focus reveal ──────────────────────────────────────────
function FocusImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.filter = "blur(0px)";
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]); // re-run when image URL changes (new generation)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      style={{
        filter: "blur(20px)",
        transition: "filter 1.4s ease",
        willChange: "filter",
      }}
    />
  );
}

interface Props {
  request?: ScenarioRequest;
}

type VideoStatus = "idle" | "pending" | "processing" | "completed" | "failed";

const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_MAX_POLLS = 60; // 60 × 3 s = 180 s — covers Kling 2.5-turbo (15–30 s typical, 90 s max)

export default function ScenarioStream({ request }: Props) {
  const scrollProgress = useScrollProgress();

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef("");
  const imageRequestedRef = useRef(false);

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
      setVideoError("Video generation timed out. Try again.");
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
    if (!imageUrl || !request) return;

    setVideoStatus("pending");
    setVideoUrl(null);
    setVideoError(null);
    pollCountRef.current = 0;

    // Extract first "didn't happen" event as context for the motion prompt
    const firstEvent = request.events.find((e) => !e.happened);

    try {
      const res = await fetch("/api/video/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          duration: 5,
          // Pass scenario context — server calls buildMotionPrompt() for Kling
          scenarioText: textRef.current.slice(0, 400),
          eventName: firstEvent?.id ?? "",
          year: request.year,
        }),
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
    imageRequestedRef.current = false;

    function requestImage(summary: string, year: number) {
      if (imageRequestedRef.current) return;
      imageRequestedRef.current = true;
      fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioSummary: summary, year, style: "cinematic" }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const d = data as { imageUrl?: string } | null;
          if (!ignore && d?.imageUrl) setImageUrl(d.imageUrl);
        })
        .catch(() => {});
    }

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

          // Start image generation as soon as we have ~300 chars —
          // no need to wait for the full scenario to finish streaming.
          if (
            !imageRequestedRef.current &&
            textRef.current.length >= 300 &&
            request?.year !== undefined
          ) {
            requestImage(textRef.current.slice(0, 400), request.year);
          }
        }
      } catch (err) {
        if (!ignore && (err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          // Image generation was already kicked off mid-stream (after ~300 chars).
          // If for some reason it wasn't started yet (very short scenario), start now.
          if (!imageRequestedRef.current && textRef.current && request?.year !== undefined) {
            requestImage(textRef.current.slice(0, 400), request.year);
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

  // ── Render ───────────────────────────────────────────────────────────────

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

  // Split into paragraphs for per-paragraph reveal (only after streaming ends)
  const paragraphs = stripped.split(/\n\n+/).filter(Boolean);

  const videoInProgress = videoStatus === "pending" || videoStatus === "processing";

  return (
    <>
      {/* ── Fixed gold progress bar ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "2px",
          width: `${scrollProgress * 100}%`,
          background: "#c9a84c",
          boxShadow: "0 0 8px 2px rgba(201,168,76,0.6)",
          zIndex: 9999,
          transition: "width 0.1s linear",
          pointerEvents: "none",
        }}
      />

      <div className="space-y-6">
        {/* ── Scenario text ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6">
          {loading && (
            <p className="mb-3 flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              Generating history
            </p>
          )}

          {loading ? (
            /* While streaming — single block with blinking cursor (no reveal) */
            <p className="whitespace-pre-wrap leading-relaxed text-gray-200">
              {stripped}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-blink bg-indigo-400" />
            </p>
          ) : (
            /* After streaming — each paragraph reveals on scroll */
            <div className="space-y-4">
              {paragraphs.map((para, i) => (
                <RevealParagraph key={i}>{para}</RevealParagraph>
              ))}
            </div>
          )}
        </div>

        {/* ── Generated image + video section ─────────────────────────── */}
        {imageUrl && !imageUrl.startsWith("/placeholder") && (
          <div className="space-y-3">
            {/* When video is ready — show ONLY the video */}
            {videoStatus === "completed" && videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded-xl border border-gray-700 animate-fade-in"
              />
            ) : (
              /* Image — blur-to-focus reveal; acts as placeholder while video generates */
              <div className="relative rounded-xl overflow-hidden border border-gray-700">
                <FocusImage
                  src={imageUrl}
                  alt={`Alternative history ${request?.year ?? ""}`}
                  className={`w-full object-cover transition-opacity duration-300 ${
                    videoInProgress ? "opacity-60" : "opacity-100"
                  }`}
                />

                {/* Overlay spinner while video is rendering */}
                {videoInProgress && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
                    <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-violet-400" />
                    <p className="text-sm font-medium text-white drop-shadow">
                      {videoStatus === "pending"
                        ? "Starting video generation…"
                        : "Rendering video…"}
                    </p>
                    <p className="text-xs text-gray-300 drop-shadow">
                      Kling 2.5 Turbo · typically 15–30 s
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Controls row */}
            {/* {videoStatus === "idle" && (
              <button
                onClick={handleGenerateVideo}
                className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors"
              >
                <span>🎬</span> Generate Video
              </button>
            )} */}

            {/* {videoStatus === "failed" && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-400">{videoError ?? "Video generation failed."}</p>
                <button
                  onClick={handleGenerateVideo}
                  className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600"
                >
                  Retry
                </button>
              </div>
            )} */}
          </div>
        )}
      </div>
    </>
  );
}
