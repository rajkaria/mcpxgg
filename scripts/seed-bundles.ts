/**
 * S5-T19 — seed the 3 curated bundles on-chain.
 *
 * Builds the `mcpx::bundle::create` PTBs for the three launch bundles and,
 * by default, DRY-RUNS: it prints exactly what it would submit (the Move
 * call, args, server object ids, and base64 tx bytes). It cannot actually
 * sign — there is no keystore in this repo and the package id only exists
 * after the S5-T22 mainnet deploy. Real submission is therefore a separate,
 * gated step (S5-T22) using `sui client` or a funded signer.
 *
 * Server object ids: each curated bundle composes marketplace namespaces;
 * the real on-chain object ids only exist post-deploy/publish, so they are
 * read from a JSON map (env BUNDLE_SERVER_IDS_JSON or file
 * scripts/.bundle-server-ids.json) of { "<namespace>": "0x<objectId>" }.
 * Namespaces missing from the map are printed as <MISSING:namespace> so the
 * operator sees exactly what still needs publishing before seeding.
 *
 * Usage:
 *   npx tsx scripts/seed-bundles.ts            # dry-run (default)
 *   npx tsx scripts/seed-bundles.ts --submit   # refuses: no signer in repo
 *
 * Env:
 *   MCPX_PACKAGE_ID          required to emit a real target/tx
 *   USDSUI_COIN_TYPE         required by SuiTxConfig (unused by bundle::create)
 *   MCPX_REGISTRY_ID         required by SuiTxConfig shape
 *   SUI_RPC_URL              default https://fullnode.testnet.sui.io:443
 *   BUNDLE_SERVER_IDS_JSON   inline JSON map { namespace: objectId }
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildCreateBundleTx,
  type SuiTxConfig,
} from "../packages/chain/src/index";
import {
  CURATED_BUNDLES,
  type CuratedBundle,
} from "../apps/web/lib/chain/curated-bundles";

const here = dirname(fileURLToPath(import.meta.url));

function loadServerIdMap(): Record<string, string> {
  const inline = process.env.BUNDLE_SERVER_IDS_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, string>;
    } catch {
      console.error("BUNDLE_SERVER_IDS_JSON is not valid JSON — ignoring");
    }
  }
  try {
    const p = join(here, ".bundle-server-ids.json");
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function cfg(): SuiTxConfig {
  return {
    packageId: process.env.MCPX_PACKAGE_ID ?? "0xPACKAGE_AFTER_S5_T22_DEPLOY",
    coinType: process.env.USDSUI_COIN_TYPE ?? "0xUSDSUI::usdsui::USDSUI",
    sessionRegistryId: process.env.MCPX_REGISTRY_ID ?? "0xREGISTRY",
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
  };
}

async function main() {
  const submit = process.argv.includes("--submit");
  if (submit) {
    console.error(
      "Refusing --submit: no keystore/signer in this repo. Run the printed " +
        "`sui client call` (or a funded signer) after the S5-T22 mainnet deploy.",
    );
    process.exitCode = 1;
    return;
  }

  const ids = loadServerIdMap();
  const c = cfg();
  const SEED_SENDER =
    process.env.BUNDLE_SEED_SENDER ?? "0x" + "0".repeat(64);

  console.log("=== S5-T19 curated bundle seed (DRY RUN) ===");
  console.log(`package:  ${c.packageId}`);
  console.log(`rpc:      ${c.rpcUrl}`);
  console.log(
    `server-id map: ${Object.keys(ids).length} known namespace(s)\n`,
  );

  for (const b of CURATED_BUNDLES as readonly CuratedBundle[]) {
    const resolved = b.serverNamespaces.map((ns) =>
      ids[ns] ? ids[ns]! : `<MISSING:${ns}>`,
    );
    const missing = resolved.some((r) => r.startsWith("<MISSING:"));
    const discount = Math.max(0, 100 - b.priceMultiplierX100);

    console.log(`── ${b.name} (${b.slug}) — ${discount}% off ──`);
    console.log(`   servers: ${b.serverNamespaces.join(", ")}`);
    console.log(`   ids:     ${resolved.join(", ")}`);
    console.log(
      `   target:  ${c.packageId}::bundle::create(name, [${b.serverNamespaces.length} ids], ${b.priceMultiplierX100}, "", 0x6, ctx)`,
    );

    if (missing) {
      console.log(
        "   ⚠ skipping tx build — publish the missing server(s) first " +
          "(S5-T07+) and add their object ids to scripts/.bundle-server-ids.json\n",
      );
      continue;
    }

    try {
      const built = await buildCreateBundleTx({
        cfg: c,
        sender: SEED_SENDER,
        name: b.name,
        serverObjectIds: resolved,
        priceMultiplierX100: b.priceMultiplierX100,
        metadataBlobId: "",
      });
      console.log(`   txBytesB64 (${built.txBytesB64.length} chars):`);
      console.log(`   ${built.txBytesB64}\n`);
    } catch (e) {
      console.log(
        `   (tx build deferred: ${e instanceof Error ? e.message : String(e)})\n`,
      );
    }
  }

  console.log(
    "Real submission is gated on the S5-T22 mainnet deploy. After deploy:\n" +
      "  1. publish first-party servers (S5-T07+), record object ids in\n" +
      "     scripts/.bundle-server-ids.json\n" +
      "  2. set MCPX_PACKAGE_ID, then sign+submit the printed PTBs with a\n" +
      "     funded signer / `sui client call mcpx::bundle::create ...`",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
