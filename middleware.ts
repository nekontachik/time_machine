import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["uk", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "uk";

function detectLocale(req: NextRequest): Locale {
  // 1. Cookie takes priority (user's explicit choice)
  const cookie = req.cookies.get("locale")?.value;
  if (cookie === "en" || cookie === "uk") return cookie;

  // 2. Accept-Language header as fallback
  const acceptLang = req.headers.get("accept-language") ?? "";
  if (acceptLang.startsWith("en")) return "en";

  return DEFAULT_LOCALE;
}

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

  // E2E mock: set cookie when ?e2e_mock=1 so subsequent navigations use mock events
  if (pathname.startsWith("/events/") && req.nextUrl.searchParams.get("e2e_mock") === "1") {
    response.cookies.set("e2e_mock_events", "1", {
      path: "/",
      maxAge: 60 * 60,
      sameSite: "lax",
    });
  }

  // Set locale cookie if not already set
  if (!req.cookies.get("locale")) {
    const locale = detectLocale(req);
    response.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
