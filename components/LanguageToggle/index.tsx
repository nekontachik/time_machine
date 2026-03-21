"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  locale: string;
}

export default function LanguageToggle({ locale }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function switchLocale(next: string) {
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`flex gap-1 rounded-lg border border-gray-700 bg-gray-900/80 p-1 backdrop-blur-sm transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={() => switchLocale("uk")}
        className={`rounded px-2 py-0.5 text-sm font-medium transition-colors ${
          locale === "uk"
            ? "bg-indigo-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        UA
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`rounded px-2 py-0.5 text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-indigo-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        EN
      </button>
    </div>
  );
}
