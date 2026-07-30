import { NextRequest, NextResponse } from "next/server";

/**
 * Sentry tunnel endpoint.
 *
 * Ad-blockers block requests to *.ingest.sentry.io. This route proxies
 * Sentry envelope payloads through the app's own domain so they aren't
 * blocked. The Sentry SDK sends envelopes here instead of directly to
 * Sentry when `tunnel` is configured in the client config.
 *
 * Only forwards to the project's own Sentry DSN host to prevent abuse.
 */

const SENTRY_HOST = "o4511131975090176.ingest.de.sentry.io";
const SENTRY_PROJECT_IDS = ["4511131978104912"];

const MAX_ENVELOPE_BYTES = 64 * 1024; // 64 KB — comfortably above typical Sentry envelopes

export async function POST(request: NextRequest) {
  try {
    // Reject oversized payloads up-front — Sentry envelopes are typically a few KB.
    // This prevents DoS via large bodies (request.text() reads everything into memory).
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_ENVELOPE_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const envelope = await request.text();
    if (envelope.length > MAX_ENVELOPE_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const piece = envelope.split("\n")[0];
    const header = JSON.parse(piece);

    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace("/", "");

    if (dsn.hostname !== SENTRY_HOST) {
      return NextResponse.json({ error: "Invalid host" }, { status: 400 });
    }

    if (!SENTRY_PROJECT_IDS.includes(projectId)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;

    const sentryResponse = await fetch(sentryUrl, {
      method: "POST",
      body: envelope,
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
    });

    return NextResponse.json({}, { status: sentryResponse.status });
  } catch {
    return NextResponse.json(
      { error: "Invalid envelope" },
      { status: 400 }
    );
  }
}
