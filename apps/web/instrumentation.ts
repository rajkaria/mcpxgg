/**
 * S4-T21: Sentry init via Next's instrumentation hook. Dynamically imported
 * and DSN-gated so builds/CI without SENTRY_DSN (or the package) are no-ops.
 */

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      environment: process.env.NEXT_PUBLIC_SUI_NETWORK ?? "sui-testnet",
    });
  } catch {
    // @sentry/nextjs not installed in this environment — skip.
  }
}
