import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSmoke, dryTransport, type SmokeTransport } from './journey';

const baseCfg = {
  webBaseUrl: 'https://mcpx.test',
  docsBaseUrl: 'https://docs.mcpx.test',
  tool: 'walrus-search/search',
  toolArgs: { query: 'sui' },
  rechargeAtomic: 1_000_000n, // $1.00 in USDsui atomic (6 decimals)
  log: () => {},
};

test('dry self-check: the full cold-visitor journey passes offline', async () => {
  const report = await runSmoke({ ...baseCfg, transport: dryTransport() });
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.steps.map((s) => s.step),
    ['land', 'read-quickstart', 'recharge', 'call', 'see-receipt'],
  );
  assert.ok(report.steps.every((s) => s.ok));
});

test('a free-tier call (no receipt) fails the journey at the call step', async () => {
  const t: SmokeTransport = {
    ...dryTransport(),
    async callTool() {
      return { receiptId: '', settlement: 'free' };
    },
  };
  const report = await runSmoke({ ...baseCfg, transport: t });
  assert.equal(report.ok, false);
  const call = report.steps.find((s) => s.step === 'call');
  assert.equal(call?.ok, false);
  // The journey short-circuits — see-receipt never runs.
  assert.equal(
    report.steps.some((s) => s.step === 'see-receipt'),
    false,
  );
});

test('a missing landing page aborts the journey immediately', async () => {
  const t: SmokeTransport = {
    ...dryTransport(),
    async httpGet() {
      return { status: 503, body: 'maintenance' };
    },
  };
  const report = await runSmoke({ ...baseCfg, transport: t });
  assert.equal(report.ok, false);
  assert.equal(report.steps.length, 1);
  assert.equal(report.steps[0]!.step, 'land');
});

test('a receipt that never settles fails the final step', async () => {
  const t: SmokeTransport = {
    ...dryTransport(),
    async getReceipt() {
      return { found: true, success: false, settlement: 'pending' };
    },
  };
  const report = await runSmoke({ ...baseCfg, transport: t });
  assert.equal(report.ok, false);
  assert.equal(report.steps.at(-1)!.step, 'see-receipt');
  assert.equal(report.steps.at(-1)!.ok, false);
});
