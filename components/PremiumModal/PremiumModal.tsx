"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (country: string, city: string) => void;
}

export default function PremiumModal({ open, onClose, onConfirm }: Props) {
  const t = useTranslations("premium");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl">
        <h2 className="mb-2 text-2xl font-bold text-white">{t("title")}</h2>
        <p className="mb-6 text-gray-400">{t("description")}</p>

        <div className="mb-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder={t("countryPlaceholder")}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder={t("cityPlaceholder")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="mb-4 rounded-lg bg-indigo-900/40 p-4">
          <p className="text-sm font-semibold text-indigo-300">
            {t("priceLabel")}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li>• {t("feature1")}</li>
            <li>• {t("feature2")}</li>
            <li>• {t("feature3")}</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-600 py-2 text-sm text-gray-400 hover:border-gray-500"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => onConfirm(country, city)}
            disabled={!country || !city}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
