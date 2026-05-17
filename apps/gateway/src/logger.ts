/**
 * Logger factory. Pino in prod; no-op in test; console fallback if pino is
 * not installed. Mirrors the facilitator logger boundary.
 */

export interface Logger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export const NOOP_LOGGER: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function createLogger(testMode: boolean): Logger {
  if (testMode) return NOOP_LOGGER;
  let cached: Logger | null = null;
  const get = async (): Promise<Logger> => {
    if (cached) return cached;
    try {
      const mod = await import('pino');
      const inst = (mod.default ?? mod)({
        level: process.env.LOG_LEVEL ?? 'info',
        base: { app: 'gateway' },
      });
      cached = {
        info: (o, m) => inst.info(o, m),
        warn: (o, m) => inst.warn(o, m),
        error: (o, m) => inst.error(o, m),
      };
    } catch {
      cached = {
        info: (o, m) => console.log('[info]', m ?? '', o),
        warn: (o, m) => console.warn('[warn]', m ?? '', o),
        error: (o, m) => console.error('[error]', m ?? '', o),
      };
    }
    return cached;
  };
  return {
    info: (o, m) => void get().then((l) => l.info(o, m)),
    warn: (o, m) => void get().then((l) => l.warn(o, m)),
    error: (o, m) => void get().then((l) => l.error(o, m)),
  };
}
