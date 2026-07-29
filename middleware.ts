import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Skip API routes, static files, and Next.js internals
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // E2E mock: set cookie when ?e2e_mock=1 so subsequent navigations use mock
  // events. Non-production only — in production this URL is shareable, so
  // anyone could hand a victim a link that makes the site serve fabricated
  // history for every year for an hour (the cookie is path="/" + maxAge 1h).
  if (
    process.env.NODE_ENV !== "production" &&
    pathname.startsWith("/events/") &&
    req.nextUrl.searchParams.get("e2e_mock") === "1"
  ) {
    response.cookies.set("e2e_mock_events", "1", {
      path: "/",
      maxAge: 60 * 60,
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
