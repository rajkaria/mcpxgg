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
  let pinoCache: Logger | null = null;
  const get = async (): Promise<Logger> => {
    if (pinoCache) return pinoCache;
    try {
      const mod = await import('pino');
      const inst = (mod.default ?? mod)({
        level: process.env.LOG_LEVEL ?? 'info',
        base: { app: 'indexer' },
      });
      pinoCache = {
        info: (o, m) => inst.info(o, m),
        warn: (o, m) => inst.warn(o, m),
        error: (o, m) => inst.error(o, m),
      };
    } catch {
      pinoCache = {
        info: (o, m) => console.log('[info]', m ?? '', o),
        warn: (o, m) => console.warn('[warn]', m ?? '', o),
        error: (o, m) => console.error('[error]', m ?? '', o),
      };
    }
    return pinoCache;
  };
  return {
    info: (o, m) => void get().then((l) => l.info(o, m)),
    warn: (o, m) => void get().then((l) => l.warn(o, m)),
    error: (o, m) => void get().then((l) => l.error(o, m)),
  };
}
