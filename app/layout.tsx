import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/layout/InstallPrompt";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";

export const metadata: Metadata = {
  metadataBase: new URL("https://time-machine-mu.vercel.app"),
  title: "Time Machine — AI Alternative History",
  description:
    "Pick a year, change history, see the alternative future. Powered by AI.",
  manifest: "/manifest.json",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "Time Machine",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Time Machine — AI Alternative History",
    description:
      "AI-powered PWA exploring alternative history. Pick a year, change history, and see the alternative future unfold with streaming narratives and cinematic AI-generated images.",
    url: "https://time-machine-mu.vercel.app",
    siteName: "Time Machine",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Time Machine — AI Alternative History",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Time Machine — AI Alternative History",
    description:
      "AI-powered PWA exploring alternative history. Pick a year, change history, and see the alternative future unfold with streaming narratives and cinematic AI-generated images.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Time Machine — AI Alternative History",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
