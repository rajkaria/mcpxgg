/**
 * Logger factory. Pino in prod; console-based in test/local dev.
 */

import type { Logger } from './app.js';

export function createLogger(testMode: boolean): Logger {
  if (testMode) {
    return {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
  }
  // Prod: pino is loaded lazily so test runs without pino installed still work.
  return lazyPinoLogger();
}

function lazyPinoLogger(): Logger {
  let pino: Logger | null = null;
  const get = async (): Promise<Logger> => {
    if (pino) return pino;
    try {
      const mod = await import('pino');
      const inst = (mod.default ?? mod)({
        level: process.env.LOG_LEVEL ?? 'info',
        base: { app: 'facilitator' },
      });
      pino = {
        info: (o, m) => inst.info(o, m),
        warn: (o, m) => inst.warn(o, m),
        error: (o, m) => inst.error(o, m),
      };
      return pino;
    } catch {
      // Pino not installed in this environment; fall back to console.
      pino = {
        info: (o, m) => console.log('[info]', m ?? '', o),
        warn: (o, m) => console.warn('[warn]', m ?? '', o),
        error: (o, m) => console.error('[error]', m ?? '', o),
      };
      return pino;
    }
  };
  return {
    info: (o, m) => void get().then((l) => l.info(o, m)),
    warn: (o, m) => void get().then((l) => l.warn(o, m)),
    error: (o, m) => void get().then((l) => l.error(o, m)),
  };
}
