/**
 * Hono app composition. Exported separately from `index.ts` so the test
 * harness can construct an app over an in-memory backend.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { X402_VERSION, settleResultToWire } from '@mcpxgg/x402';
import type { SuiBackend } from './sui/backend.js';
import type { FacilitatorEnv } from './env.js';
import { GasStation } from './gas-station.js';
import { settlePayment } from './settle.js';
import { verifyPayment } from './verify.js';

export interface AppDeps {
  env: FacilitatorEnv;
  backend: SuiBackend;
  gasStation: GasStation;
  logger?: Logger;
}

export interface Logger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

const NOOP_LOGGER: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function createApp(deps: AppDeps): Hono {
  const log = deps.logger ?? NOOP_LOGGER;
  const app = new Hono();

  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/supported', (c) => {
    return c.json({
      schemes: ['exact', 'upto'],
      networks: [deps.env.network],
      tokenType: deps.env.usdsuiTypeTag,
      facilitatorVersion: deps.env.testMode ? 'test' : '0.1.0',
      x402Version: X402_VERSION,
    });
  });

  app.post('/verify', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { isValid: false, invalidReason: 'malformed_payload', message: 'invalid JSON' },
        400,
      );
    }
    if (!isObject(body)) {
      return c.json(
        { isValid: false, invalidReason: 'malformed_payload', message: 'expected object body' },
        400,
      );
    }
    const result = await verifyPayment(
      { payload: body.payload, details: body.details },
      deps.backend,
      deps.env,
    );
    log.info(
      {
        action: 'verify',
        isValid: result.isValid,
        invalidReason: result.invalidReason,
      },
      'verify',
    );
    return c.json(result);
  });

  app.post('/settle', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { success: false, errorCode: 'verify_failed', errorMessage: 'invalid JSON' },
        400,
      );
    }
    if (!isObject(body)) {
      return c.json(
        { success: false, errorCode: 'verify_failed', errorMessage: 'expected object body' },
        400,
      );
    }
    const result = await settlePayment(
      {
        payload: body.payload,
        details: body.details,
        ...(typeof body.receiptBlobId === 'string' && { receiptBlobId: body.receiptBlobId }),
        ...(typeof body.success === 'boolean' && { success: body.success }),
      },
      deps.backend,
      deps.env,
      deps.gasStation,
    );
    log.info(
      {
        action: 'settle',
        success: result.success,
        errorCode: result.errorCode,
        txDigest: result.txDigest,
      },
      'settle',
    );
    const httpStatus = result.success ? 200 : result.errorCode === 'rate_limited' ? 429 : 400;
    return c.json(settleResultToWire(result), httpStatus);
  });

  app.get('/admin/gas-station', (c) => {
    const snap = deps.gasStation.snapshot();
    return c.json({
      rateUsed: snap.rateUsed,
      ratePerMinute: deps.env.gasStationRateLimitPerMin,
      spentTodayMist: snap.spentTodayMist.toString(),
      dailyBudgetMist: deps.env.gasStationDailyBudgetSui.toString(),
      currentUtcDay: snap.currentUtcDay,
    });
  });

  return app;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
