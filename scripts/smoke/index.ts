/**
 * S8-T19 — docs + landing E2E smoke CLI.
 *
 * DRY self-check (default — CI / offline safe, no live stack):
 *   tsx scripts/smoke/index.ts
 *
 * Against a real deployment:
 *   MCPX_API_KEY=mcpx_sk_... \
 *   tsx scripts/smoke/index.ts \
 *     --web=https://mcpx.gg --docs=https://docs.mcpx.gg \
 *     --tool=walrus-search/search --live
 *
 * Flags:
 *   --live          hit the real stack (default: dry stub transport)
 *   --web=URL        web app base url (default https://mcpx.gg)
 *   --docs=URL       docs site base url (default https://docs.mcpx.gg)
 *   --tool=NS/TOOL   tool to exercise (default walrus-search/search)
 *
 * Exits non-zero if any journey step fails, so it can gate a post-deploy
 * verification step. The live transport is intentionally thin — it asserts
 * the *journey wiring* (routes resolve, recharge funds a session, a call
 * mints a settled receipt that the read API then returns); it is NOT a
 * substitute for the Move-level e2e_tests.move settlement proofs.
 */

import { createMCPXClient } from '@mcpxgg/sdk';
import { runSmoke, dryTransport, type SmokeConfig, type SmokeTransport } from './journey';

function flag(argv: string[], k: string, d?: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
}

function liveTransport(webBaseUrl: string, apiKey: string): SmokeTransport {
  const client = createMCPXClient({ baseUrl: webBaseUrl, apiKey });
  return {
    async httpGet(url) {
      const res = await fetch(url, { redirect: 'follow' });
      return { status: res.status, body: await res.text() };
    },
    async recharge(amountAtomic) {
      const res = await fetch(`${webBaseUrl}/api/session/recharge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ amountAtomic: amountAtomic.toString() }),
      });
      if (!res.ok) throw new Error(`recharge ${res.status}`);
      const j = (await res.json()) as { sessionId?: string };
      return { sessionId: j.sessionId ?? '' };
    },
    async callTool(tool, args) {
      const slash = tool.indexOf('/');
      const name = slash >= 0 ? tool.slice(slash + 1) : tool;
      const r = await client.callTool(name, args);
      return {
        receiptId: r.receipt?.txDigest ? String(r.receipt.txDigest) : '',
        settlement: (r.receipt?.settlement as 'settled' | 'pending' | 'free') ?? 'free',
      };
    },
    async getReceipt(receiptId) {
      const res = await fetch(`${webBaseUrl}/api/receipts/${receiptId}`);
      if (!res.ok) return { found: false, success: false, settlement: 'unknown' };
      const j = (await res.json()) as { success?: boolean; settlement?: string };
      return {
        found: true,
        success: Boolean(j.success),
        settlement: j.settlement ?? 'unknown',
      };
    },
  };
}

async function main(argv: string[]): Promise<void> {
  const live = argv.includes('--live');
  const webBaseUrl = flag(argv, 'web', 'https://mcpx.gg')!;
  const docsBaseUrl = flag(argv, 'docs', 'https://docs.mcpx.gg')!;
  if (live && !process.env.MCPX_API_KEY) {
    throw new Error('--live requires MCPX_API_KEY to be set');
  }
  const cfg: SmokeConfig = {
    webBaseUrl,
    docsBaseUrl,
    tool: flag(argv, 'tool', 'walrus-search/search')!,
    toolArgs: { query: 'sui' },
    rechargeAtomic: 1_000_000n,
    transport: live
      ? liveTransport(webBaseUrl, process.env.MCPX_API_KEY!)
      : dryTransport(),
    log: (l) => console.log(l),
  };
  const report = await runSmoke(cfg);
  console.log(`smoke: ${report.ok ? 'PASS' : 'FAIL'} in ${report.totalMs}ms`);
  if (!report.ok) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
