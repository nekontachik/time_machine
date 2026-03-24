"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (country: string, city: string) => void;
}

export default function PremiumModal({ open, onClose, onConfirm }: Props) {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Premium — Local Impact</h2>
        <p className="mb-6 text-gray-400">Find out how this alternative reality would have impacted your city.</p>

        <div className="mb-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Country (e.g. USA)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="City (e.g. New York)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="mb-4 rounded-lg bg-indigo-900/40 p-4">
          <p className="text-sm font-semibold text-indigo-300">
            Premium — $4.99 / month
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li>• Unlimited requests</li>
            <li>• Local impact (city + country)</li>
            <li>• AI video (coming soon)</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-600 py-2 text-sm text-gray-400 hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(country, city)}
            disabled={!country || !city}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Get Premium
          </button>
        </div>
      </div>
    </div>
  );
}
