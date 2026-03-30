import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization (replaces sentry.server.config.ts)
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Capture 10% of server transactions in production
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      enabled: process.env.NODE_ENV === "production",

      // Capture unhandled promise rejections
      integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

      beforeSend(event) {
        // Attach AI provider context to errors for easier debugging
        const aiProviderErrors = ["fal_auth", "openrouter", "redis"];
        const errorMsg = event.exception?.values?.[0]?.value ?? "";
        if (aiProviderErrors.some((p) => errorMsg.toLowerCase().includes(p))) {
          event.tags = { ...event.tags, ai_provider_error: true };
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization (replaces sentry.edge.config.ts)
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}
