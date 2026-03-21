import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import ScenarioStream from "@/components/ScenarioStream/ScenarioStream";
// import ShareCard from "@/components/ShareCard/ShareCard";
import type { ScenarioRequest, Lang } from "@/types";

interface Props {
  searchParams: {
    year?: string;
    lang?: string;
    events?: string;
    imageUrl?: string;
    /** Title of the first "didn't happen" event — used for OG "Що якби X не сталося?" */
    eventTitle?: string;
  };
}

const OG_DEFAULT_IMAGE = "/og-default.jpg";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const year = parseInt(searchParams.year ?? "", 10);
  const lang = searchParams.lang ?? "ua";
  const imageUrl = searchParams.imageUrl ?? null;
  const eventTitle = searchParams.eventTitle ?? null;
  const isEn = lang === "en";

  const bce = isEn ? "BCE" : "до н.е.";
  const displayYear = !isNaN(year)
    ? year < 0
      ? `${Math.abs(year)} ${bce}`
      : String(year)
    : "";

  // Title: "Що якби X не сталося? | Time Machine" when event title is available,
  // otherwise fall back to the year-based generic title.
  let title: string;
  if (eventTitle) {
    title = isEn
      ? `What if ${eventTitle} never happened? | Time Machine`
      : `Що якби «${eventTitle}» не сталося? | Time Machine`;
  } else {
    title = isEn
      ? `Alternative History${displayYear ? ` — ${displayYear}` : ""} | Time Machine`
      : `Альтернативна історія${displayYear ? ` — ${displayYear}` : ""} | Time Machine`;
  }

  // Description: generic AI blurb (scenario text is not available server-side at
  // metadata generation time — it is streamed client-side).
  const description = isEn
    ? `Discover what the world could have been like in ${displayYear}. An AI-generated alternative history scenario.`
    : `Дізнайтесь, яким міг бути світ у ${displayYear}. Альтернативна історія, згенерована ШІ.`;

  // OG image: use the generated image when available; fall back to default.
  const ogImageUrl = imageUrl ?? OG_DEFAULT_IMAGE;
  const ogImages = [{ url: ogImageUrl, width: 1200, height: 630 }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function ScenarioPage({ searchParams }: Props) {
  const year = parseInt(searchParams.year ?? "", 10);
  const lang = (searchParams.lang ?? "ua") as Lang;
  const isEn = lang === "en";

  let request: ScenarioRequest | undefined;
  try {
    const events = JSON.parse(searchParams.events ?? "[]");
    if (!isNaN(year) && Array.isArray(events) && events.length > 0) {
      request = { year, events, lang };
    }
  } catch {
    // malformed events param — leave request undefined, show placeholder
  }

  const bce = isEn ? "BCE" : "до н.е.";
  const displayYear = !isNaN(year)
    ? year < 0
      ? `${Math.abs(year)} ${bce}`
      : String(year)
    : "";

  const title = isEn ? "Alternative History" : "Альтернативна історія";
  const generating = isEn ? "Generating..." : "Генерація...";

  const backLabel = isEn ? "New scenario" : "Новий сценарій";

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← {backLabel}
      </Link>
      <h2 className="mb-8 text-3xl font-bold text-white">
        {title}{displayYear ? ` — ${displayYear}` : ""}
      </h2>
      <Suspense fallback={<p className="text-gray-400">{generating}</p>}>
        <ScenarioStream request={request} />
      </Suspense>
      {/* {!isNaN(year) && <ShareCard year={year} />} */}
    </main>
  );
}
