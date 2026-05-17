/**
 * S4-T21: shared Sentry bootstrap for the Node services (gateway,
 * facilitator, indexer). Dynamically imports @sentry/node so the dependency
 * is optional — DSN-gated, no-op if unset or not installed.
 */

export async function initSentry(serviceName: string): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = (await import('@sentry/node')) as {
      init: (o: Record<string, unknown>) => void;
    };
    Sentry.init({
      dsn,
      serverName: serviceName,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      environment: process.env.SUI_NETWORK ?? 'sui-testnet',
    });
  } catch {
    /* @sentry/node not installed — skip */
  }
}
