"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  year?: number;
  summary?: string;
  imageUrl?: string;
}

export default function ShareCard({ year, summary, imageUrl }: Props) {
  const t = useTranslations("shareCard");
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `${t("altHistory")} ${year ?? ""}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: silently ignore
    }
  }

  function handleTelegram() {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!year && !summary) return null;

  return (
    <div className="mt-8 rounded-xl border border-gray-700 bg-gray-800/40 p-6">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="AI generated scene"
          className="mb-4 w-full rounded-lg object-cover"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-400">
          {year && <span className="font-semibold text-white">{year} </span>}
          {t("altReality")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleTelegram}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            title={t("shareTelegram")}
          >
            Telegram
          </button>
          <button
            onClick={handleTwitter}
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
            title={t("shareTwitter")}
          >
            Twitter / X
          </button>
          <button
            onClick={handleCopy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {copied ? t("copied") : t("share")}
          </button>
        </div>
      </div>
    </div>
  );
}
