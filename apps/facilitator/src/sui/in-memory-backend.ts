/**
 * In-memory SuiBackend for tests and local dev. Behaves like the real one
 * but mutates its own state instead of submitting transactions.
 *
 * Construct via `createInMemorySuiBackend({ ... })`. Mutate state via the
 * returned helpers (`setSession`, `setPlatformConfig`, etc.) before calls.
 */

import { ChainError } from './types.js';
import type {
  PlatformConfigView,
  SessionView,
  SettleSubmitParams,
  SettleSubmitResult,
} from './types.js';
import type { SuiBackend } from './backend.js';

export interface InMemoryBackendOptions {
  /** Sessions keyed by sessionObjectId. */
  sessions?: Record<string, SessionView>;
  platformConfig?: PlatformConfigView;
  /** ed25519 verifier — return true if (sig, message, payer) is acceptable.
   *  Default: signatures of the form `valid:<payerAddress>` are accepted. */
  verifyImpl?: (sig: string, message: string, payerAddress: string) => boolean | Promise<boolean>;
  /** If set, every submitSettle throws this error. */
  failSubmitWith?: ChainError;
  /** Initial timestamp (ms). Advance via `tickMs(n)`. */
  initialNowMs?: number;
}

export interface InMemorySuiBackend extends SuiBackend {
  setSession(s: SessionView): void;
  setPlatformConfig(c: PlatformConfigView): void;
  tickMs(n: number): void;
  /** All settlements processed by this backend, in order. */
  submitted: SettleSubmitResult[];
  /** Params of every submitSettle, in order — lets tests assert the intent
   *  path was taken (intentId/category present) without a real chain. */
  submittedParams: SettleSubmitParams[];
}

export function createInMemorySuiBackend(opts: InMemoryBackendOptions = {}): InMemorySuiBackend {
  const sessions = new Map<string, SessionView>(
    Object.entries(opts.sessions ?? {}),
  );
  let platformConfig: PlatformConfigView = opts.platformConfig ?? {
    takeRateBps: 250,
    insuranceBps: 50,
    subsidyAtomic: 0n,
    paused: false,
  };
  let nowMs = opts.initialNowMs ?? 1_700_000_000_000;
  const submitted: SettleSubmitResult[] = [];
  const submittedParams: SettleSubmitParams[] = [];

  const verifyImpl =
    opts.verifyImpl ??
    ((sig, _msg, payer) => sig === `valid:${payer}`);

  let settleCounter = 0;

  const backend: InMemorySuiBackend = {
    submitted,
    submittedParams,

    async getSession(id): Promise<SessionView | null> {
      return sessions.get(id) ?? null;
    },

    async getPlatformConfig(): Promise<PlatformConfigView> {
      return { ...platformConfig };
    },

    async verifyEd25519(sig, msg, payer): Promise<boolean> {
      return Promise.resolve(verifyImpl(sig, msg, payer));
    },

    async submitSettle(params: SettleSubmitParams): Promise<SettleSubmitResult> {
      submittedParams.push(params);
      if (opts.failSubmitWith) throw opts.failSubmitWith;
      const session = sessions.get(params.sessionObjectId);
      if (!session) {
        throw new ChainError('execution_failed', 'session not found at submit time');
      }
      // Upto scheme: only the metered actual is debited; the contract rejects
      // actual > quoted_max, so mirror that here.
      const isUpto = params.uptoActualAtomic !== undefined;
      const debit = isUpto
        ? (params.uptoActualAtomic as bigint)
        : params.amountAtomic;
      if (isUpto && debit > params.amountAtomic) {
        throw new ChainError(
          'execution_failed',
          `upto actual ${debit} exceeds quoted max ${params.amountAtomic}`,
        );
      }
      // Mirror chain debit semantics.
      const today = backend.todayEpochDay();
      const isNewDay = session.todayEpochDay !== today;
      const newToday = isNewDay ? debit : session.todaySpentAtomic + debit;
      const updated: SessionView = {
        ...session,
        balanceAtomic: session.balanceAtomic - debit,
        todaySpentAtomic: newToday,
        todayEpochDay: today,
      };
      sessions.set(session.sessionObjectId, updated);
      settleCounter += 1;
      const result: SettleSubmitResult = {
        txDigest: `0xtx${settleCounter.toString(16).padStart(8, '0')}`,
        receiptObjectId: `0xrcpt${settleCounter.toString(16).padStart(8, '0')}`,
        settledAmountAtomic: debit,
        ...(isUpto && {
          quotedMaxAtomic: params.amountAtomic,
          unusedAtomic:
            params.amountAtomic > debit ? params.amountAtomic - debit : 0n,
        }),
      };
      submitted.push(result);
      return result;
    },

    nowMs(): number {
      return nowMs;
    },

    todayEpochDay(): number {
      return Math.floor(nowMs / 86_400_000);
    },

    setSession(s: SessionView): void {
      sessions.set(s.sessionObjectId, s);
    },

    setPlatformConfig(c: PlatformConfigView): void {
      platformConfig = c;
    },

    tickMs(n: number): void {
      nowMs += n;
    },
  };

  return backend;
}
