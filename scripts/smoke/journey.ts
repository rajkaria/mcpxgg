/**
 * S8-T19 — docs + landing E2E smoke journey (core, dependency-free of
 * argv/process so it is unit-testable).
 *
 * Models the cold-visitor critical path as an ordered list of steps:
 *
 *   1. land            GET  /                         (landing page 200, has hero copy)
 *   2. read-quickstart GET  <docs>/docs/quickstart/user (quickstart doc 200)
 *   3. recharge        POST <web>/api/session/recharge  ($1 → session funded)
 *   4. call            tools/call walrus-search via the gateway
 *   5. see-receipt     GET  <web>/api/receipts/:id      (receipt visible, settled)
 *
 * Every step goes through the injectable `SmokeTransport` so the journey is
 * unit-testable and has a built-in "dry" self-check (no network) — the same
 * pattern as the loadtest harness. `--live` swaps in the real fetch/SDK
 * transport against a deployed stack.
 */

export interface SmokeStepResult {
  step: string;
  ok: boolean;
  detail: string;
  ms: number;
}

export interface SmokeReport {
  ok: boolean;
  steps: SmokeStepResult[];
  totalMs: number;
}

/** Everything the journey needs from the outside world. */
export interface SmokeTransport {
  /** HTTP GET → { status, body } (body lower-cased substring checks only). */
  httpGet(url: string): Promise<{ status: number; body: string }>;
  /** Recharge the visitor's session by USDsui atomic amount; returns session id. */
  recharge(amountAtomic: bigint): Promise<{ sessionId: string }>;
  /** Call a tool through the gateway; returns the minted receipt id + settle state. */
  callTool(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<{ receiptId: string; settlement: 'settled' | 'pending' | 'free' }>;
  /** Fetch a receipt by id from the web read API. */
  getReceipt(
    receiptId: string,
  ): Promise<{ found: boolean; success: boolean; settlement: string }>;
}

export interface SmokeConfig {
  /** Base URL of the web app (landing, recharge, receipts). */
  webBaseUrl: string;
  /** Base URL of the docs site. */
  docsBaseUrl: string;
  /** Tool to exercise. Default `walrus-search/search`. */
  tool: string;
  toolArgs: Record<string, unknown>;
  /** $1.00 in USDsui atomic (6 decimals). */
  rechargeAtomic: bigint;
  transport: SmokeTransport;
  log?: (line: string) => void;
}

/** A self-contained stub transport: every step succeeds with realistic shapes. */
export function dryTransport(): SmokeTransport {
  return {
    async httpGet(url) {
      const body = url.includes('quickstart')
        ? '<h1>quickstart</h1> connect privy, recharge $1, call a tool, see your receipt'
        : '<h1>on-chain mcp marketplace settled in usdsui</h1>';
      return { status: 200, body };
    },
    async recharge() {
      return { sessionId: '0xSESSIONdeadbeef' };
    },
    async callTool() {
      return { receiptId: '0xRECEIPTfeedface', settlement: 'settled' };
    },
    async getReceipt() {
      return { found: true, success: true, settlement: 'settled' };
    },
  };
}

export async function runSmoke(cfg: SmokeConfig): Promise<SmokeReport> {
  const log = cfg.log ?? (() => {});
  const steps: SmokeStepResult[] = [];
  const t0 = Date.now();

  const record = async (
    step: string,
    fn: () => Promise<{ ok: boolean; detail: string }>,
  ): Promise<boolean> => {
    const s0 = Date.now();
    try {
      const { ok, detail } = await fn();
      const r = { step, ok, detail, ms: Date.now() - s0 };
      steps.push(r);
      log(`${ok ? 'PASS' : 'FAIL'} ${step} (${r.ms}ms) — ${detail}`);
      return ok;
    } catch (e) {
      steps.push({ step, ok: false, detail: String(e), ms: Date.now() - s0 });
      log(`FAIL ${step} — ${String(e)}`);
      return false;
    }
  };

  const finish = (): SmokeReport => ({
    ok: steps.every((s) => s.ok),
    steps,
    totalMs: Date.now() - t0,
  });

  // 1. Cold visitor lands.
  if (
    !(await record('land', async () => {
      const { status, body } = await cfg.transport.httpGet(`${cfg.webBaseUrl}/`);
      const hit = status === 200 && body.toLowerCase().includes('usdsui');
      return { ok: hit, detail: `status=${status}` };
    }))
  )
    return finish();

  // 2. Reads the quickstart.
  if (
    !(await record('read-quickstart', async () => {
      const { status, body } = await cfg.transport.httpGet(
        `${cfg.docsBaseUrl}/docs/quickstart/user`,
      );
      const hit = status === 200 && body.toLowerCase().includes('receipt');
      return { ok: hit, detail: `status=${status}` };
    }))
  )
    return finish();

  // 3. Recharges $1.
  let sessionId = '';
  if (
    !(await record('recharge', async () => {
      const { sessionId: sid } = await cfg.transport.recharge(cfg.rechargeAtomic);
      sessionId = sid;
      return { ok: Boolean(sid), detail: `session=${sid}` };
    }))
  )
    return finish();

  // 4. Calls walrus-search.
  let receiptId = '';
  if (
    !(await record('call', async () => {
      const r = await cfg.transport.callTool(cfg.tool, cfg.toolArgs);
      receiptId = r.receiptId;
      const ok = Boolean(r.receiptId) && r.settlement !== 'free';
      return { ok, detail: `receipt=${r.receiptId} settle=${r.settlement}` };
    }))
  )
    return finish();

  // 5. Sees the receipt.
  await record('see-receipt', async () => {
    const r = await cfg.transport.getReceipt(receiptId);
    return {
      ok: r.found && r.success,
      detail: `found=${r.found} success=${r.success} settle=${r.settlement}`,
    };
  });

  void sessionId; // surfaced in the recharge step detail
  return finish();
}
