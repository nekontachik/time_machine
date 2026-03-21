import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import LanguageToggle from "@/components/LanguageToggle";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

type Locale = "uk" | "en";

export const metadata: Metadata = {
  title: "Time Machine — AI Alternative History",
  description:
    "Pick a year, change history, see the alternative future. Powered by AI.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Time Machine",
  },
  openGraph: {
    title: "Time Machine — AI Alternative History",
    description: "Pick a year, change history, see the alternative future.",
    type: "website",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Time Machine — AI Alternative History",
    description: "Pick a year, change history, see the alternative future.",
    images: ["/og-default.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const raw = cookies().get("locale")?.value;
  const locale: Locale = raw === "en" ? "en" : "uk";
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <html lang={locale === "uk" ? "uk" : "en"}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="fixed right-4 top-4 z-40">
            <LanguageToggle locale={locale} />
          </header>
          {children}
          <InstallPrompt />
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
