"use client";

import { useTranslations } from "next-intl";

export default function HomeSubtitle() {
  const t = useTranslations("home");
  return (
    <p className="mb-12 text-center text-lg text-gray-400">{t("subtitle")}</p>
  );
}
