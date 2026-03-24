import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/layout/InstallPrompt";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";

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
