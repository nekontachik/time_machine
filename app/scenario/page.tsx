import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import ScenarioStream from "@/components/features/ScenarioStream/ScenarioStream";
// import ShareCard from "@/components/ShareCard/ShareCard";
import type { ScenarioRequest, Lang } from "@/types";
import { safeOgImage, safeTitleFragment } from "@/lib/og";
import { formatYear } from "@/lib/formatYear";

interface Props {
  searchParams: {
    year?: string;
    lang?: string;
    events?: string;
    imageUrl?: string;
    /** Title of the first "didn't happen" event — used for the OG title. */
    eventTitle?: string;
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const year = parseInt(searchParams.year ?? "", 10);
  const eventTitle = safeTitleFragment(searchParams.eventTitle);

  const displayYear = !isNaN(year) ? String(year) : "";

  // Title: event-specific when a title is available, otherwise year-based generic.
  const title = eventTitle
    ? `What if ${eventTitle} never happened? | Time Machine`
    : `Alternative History${displayYear ? ` — ${displayYear}` : ""} | Time Machine`;

  // Description: generic AI blurb (scenario text is streamed client-side and is
  // not available at metadata generation time).
  const description = `Discover what the world could have been like in ${displayYear}. An AI-generated alternative history scenario.`;

  // OG image: use the generated image when it is on the allowlist, else default.
  const ogImageUrl = safeOgImage(searchParams.imageUrl);
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
  // English-only product (see types/index.ts). Anything else in the query
  // string is ignored rather than trusted — lang is echoed into links and,
  // via ScenarioRequest, into the model prompt.
  const lang: Lang = "en";

  let request: ScenarioRequest | undefined;
  try {
    const events = JSON.parse(searchParams.events ?? "[]");
    if (!isNaN(year) && Array.isArray(events) && events.length > 0) {
      request = { year, events, lang };
    }
  } catch {
    // malformed events param — leave request undefined, show placeholder
  }

  const displayYear = !isNaN(year) ? formatYear(year) : "";

  const title = "Alternative History";
  const generating = "Generating...";
  const backLabel = "New scenario";
  const backToYearLabel = "Choose another year";

  // If no valid request could be built, show a friendly message instead of an error
  if (!request) {
    const missingMsg =
      "No events selected. Please go back and choose events to generate a scenario.";

    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← {backLabel}
        </Link>
        <h2 className="mb-8 text-3xl font-bold text-white">{title}</h2>
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6">
          <p className="text-gray-400">{missingMsg}</p>
          <Link
            href={!isNaN(year) ? `/events/${year}?lang=${lang}` : "/"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            ← {!isNaN(year) ? "Back to events" : backLabel}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/events/${year}?lang=${lang}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← {backLabel}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          {backToYearLabel}
        </Link>
      </div>
      <h2 className="mb-8 text-3xl font-bold text-white">
        {title}
        {displayYear && (
          <span className="block text-xl font-normal text-gray-400">
            Year {displayYear}
          </span>
        )}
      </h2>
      <Suspense fallback={<p className="text-gray-400">{generating}</p>}>
        <ScenarioStream request={request} />
      </Suspense>
      {/* {!isNaN(year) && <ShareCard year={year} />} */}
    </main>
  );
}
