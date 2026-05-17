/**
 * Publish orchestration (S5-T08..T11).
 *
 * `runPublish` is pure-ish and fully injectable so tests drive it with the
 * InMemorySuiAdapter + in-memory Walrus backend and zero network. The
 * Commander wrapper (commander.ts) wires the real adapter/Walrus/fetch.
 *
 * Flow:
 *   a. load + schema-validate mcpx.config.json          (S5-T08)
 *   b. namespace uniqueness via the ChainAdapter        (S5-T09)
 *   c. endpoint /health probe (2xx required)            (S5-T10)
 *   d. price-range validation                           (S5-T08)
 *   e. upload README.md + per-tool input schemas → Walrus
 *   f. assemble the publish_server PTB (dry-run or sign) (S5-T11)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig, type McpxConfig } from '@mcpxgg/shared/validation/config-schema';
import type { ChainAdapter } from '@mcpxgg/chain';
import {
  buildPublishServerTx,
  buildAddToolsTx,
  signAndExecuteBase64Tx,
  type SuiTxConfig,
} from '@mcpxgg/chain';
import type { WalrusClient } from '@mcpxgg/walrus';

/**
 * Per-tool price ceiling. u64 max ($1.8e13 in USDsui 6-decimal atomic units)
 * is the hard chain limit; we additionally reject anything above
 * 1_000_000_000_000 atomic = 1,000,000 USDsui per call as an obvious
 * misconfiguration guard. Documented so server authors know the bound.
 */
export const MAX_TOOL_PRICE_ATOMIC = 1_000_000_000_000n;

export interface PublishOptions {
  dir: string;
  /** Default true — assemble + print the tx, never sign/submit. */
  dryRun: boolean;
  /** Skip the endpoint /health probe. */
  skipHealth: boolean;
  /**
   * Sender Sui address (publisher). Required to assemble the PTB. From
   * --address or MCPXGG_PUBLISH_ADDRESS.
   */
  senderAddress: string;
  /** ed25519 private key (hex/suiprivkey) for non-dry-run signing. */
  privateKey?: string | undefined;
}

export interface PublishDeps {
  adapter: ChainAdapter;
  walrus: WalrusClient;
  /** Endpoint health probe. Injected so tests don't hit the network. */
  healthCheck: (url: string) => Promise<{ ok: boolean; status: number }>;
  /**
   * Assembles the publish_server PTB. Injected so tests don't need
   * @mysten/sui or a live RPC. Defaults to the real chain tx-builder.
   */
  buildTx?: typeof buildPublishServerTx;
  buildToolsTx?: typeof buildAddToolsTx;
  /** Sui tx config (package id, registry id, rpc). From env in the CLI. */
  txConfig?: SuiTxConfig;
}

export interface UploadedBlob {
  name: string;
  blobId: string;
  size: number;
}

export interface PublishResult {
  namespace: string;
  config: McpxConfig;
  metadataBlobId: string;
  toolSchemaBlobIds: Record<string, string>;
  uploads: UploadedBlob[];
  dryRun: boolean;
  /** Assembled (unsigned) base64 tx, present on dry-run + before signing. */
  txBytesB64: string;
  /** Populated only when a real submission happened (non-dry-run). */
  serverObjectId?: string;
  ownerCapId?: string;
  txDigest?: string;
  explorerUrl?: string;
}

export class PublishError extends Error {
  constructor(
    message: string,
    readonly detail?: string[],
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/** Reads + parses mcpx.config.json, raising readable errors. */
export async function loadConfig(dir: string): Promise<McpxConfig> {
  const path = join(dir, 'mcpx.config.json');
  if (!existsSync(path)) {
    throw new PublishError(`mcpx.config.json not found in ${dir}`);
  }
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (e) {
    throw new PublishError(`could not read ${path}: ${String(e)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new PublishError(`mcpx.config.json is not valid JSON: ${String(e)}`);
  }
  const result = validateConfig(parsed);
  if (!result.valid) {
    throw new PublishError('mcpx.config.json failed schema validation', result.errors);
  }
  return parsed as McpxConfig;
}

/** Endpoint URL minus trailing slash, joined with /health. */
function healthUrl(endpointUrl: string): string {
  return `${endpointUrl.replace(/\/+$/, '')}/health`;
}

/**
 * Extra price-range validation on top of the shared schema. The schema
 * already enforces ≥ 0 and ≤ u64 max; here we also reject the absurd-high
 * band and (matching `registry::add_tool`'s `E_INVALID_PRICE`) require
 * priced tools to be > 0 only when they are not explicitly free.
 */
export function validatePriceRanges(config: McpxConfig): string[] {
  const errors: string[] = [];
  for (let i = 0; i < config.tools.length; i++) {
    const t = config.tools[i]!;
    const price = t.priceAtomic;
    if (price < 0n) {
      errors.push(`tools[${i}] "${t.name}": priceAtomic must be ≥ 0`);
    }
    if (price > MAX_TOOL_PRICE_ATOMIC) {
      errors.push(
        `tools[${i}] "${t.name}": priceAtomic ${price} exceeds the ${MAX_TOOL_PRICE_ATOMIC} atomic ceiling (1,000,000 USDsui)`,
      );
    }
  }
  return errors;
}

export async function runPublish(
  opts: PublishOptions,
  deps: PublishDeps,
): Promise<PublishResult> {
  // (a) load + schema validate
  const config = await loadConfig(opts.dir);

  // (d) price-range validation (run early — cheap, fails fast)
  const priceErrors = validatePriceRanges(config);
  if (priceErrors.length > 0) {
    throw new PublishError('price validation failed', priceErrors);
  }

  // (b) namespace uniqueness
  if (await deps.adapter.isNamespaceTaken(config.namespace)) {
    throw new PublishError(
      `namespace "${config.namespace}" is already registered on ${deps.adapter.displayName}. Pick a different namespace.`,
    );
  }

  // (c) endpoint health probe
  if (!opts.skipHealth) {
    const url = healthUrl((config as unknown as { endpointUrl?: string }).endpointUrl ?? '');
    const endpointUrl = (config as unknown as { endpointUrl?: string }).endpointUrl;
    if (!endpointUrl) {
      throw new PublishError('mcpx.config.json is missing endpointUrl (required to publish)');
    }
    let probe: { ok: boolean; status: number };
    try {
      probe = await deps.healthCheck(url);
    } catch (e) {
      throw new PublishError(`endpoint health probe failed for ${url}: ${String(e)}`);
    }
    if (!probe.ok) {
      throw new PublishError(
        `endpoint ${url} returned HTTP ${probe.status} (need 2xx). Use --skip-health to bypass.`,
      );
    }
  }

  const endpointUrl = (config as unknown as { endpointUrl?: string }).endpointUrl;
  if (!endpointUrl) {
    throw new PublishError('mcpx.config.json is missing endpointUrl (required to publish)');
  }

  // (e) upload README + per-tool input schemas + server metadata to Walrus
  const uploads: UploadedBlob[] = [];

  const readmePath = join(opts.dir, 'README.md');
  let readmeBlobId: string | undefined;
  if (existsSync(readmePath)) {
    const readme = await readFile(readmePath, 'utf8');
    const meta = await deps.walrus.upload(new TextEncoder().encode(readme), 'text/markdown');
    readmeBlobId = meta.blobId;
    uploads.push({ name: 'README.md', blobId: meta.blobId, size: meta.size });
  }

  const toolSchemaBlobIds: Record<string, string> = {};
  for (const tool of config.tools) {
    const meta = await deps.walrus.uploadJSON(tool.inputSchema);
    toolSchemaBlobIds[tool.name] = meta.blobId;
    uploads.push({ name: `schema:${tool.name}`, blobId: meta.blobId, size: meta.size });
  }

  // Server metadata blob: the on-chain Server stores a single
  // metadata_blob_id; we pack the human-facing fields + README pointer.
  const metadata = {
    name: config.name,
    description: config.description,
    category: config.category,
    tags: config.tags,
    triggerPhrases: config.triggerPhrases,
    readmeBlobId: readmeBlobId ?? null,
    toolSchemaBlobIds,
  };
  const metaUpload = await deps.walrus.uploadJSON(metadata);
  uploads.push({ name: 'metadata.json', blobId: metaUpload.blobId, size: metaUpload.size });
  const metadataBlobId = metaUpload.blobId;

  // (f) assemble the publish_server PTB
  const buildTx = deps.buildTx ?? buildPublishServerTx;
  if (!deps.txConfig) {
    throw new PublishError(
      'missing Sui tx config (MCPX_PACKAGE_ID / MCPX_REGISTRY_ID / SUI_RPC_URL)',
    );
  }
  const built = await buildTx({
    cfg: deps.txConfig,
    registryId: deps.txConfig.sessionRegistryId,
    sender: opts.senderAddress,
    namespace: config.namespace,
    endpointUrl,
    metadataBlobId,
    category: config.category,
  });

  const result: PublishResult = {
    namespace: config.namespace,
    config,
    metadataBlobId,
    toolSchemaBlobIds,
    uploads,
    dryRun: opts.dryRun,
    txBytesB64: built.txBytesB64,
  };

  if (opts.dryRun) {
    return result;
  }

  // Non-dry-run signing seam. The CLI deliberately does NOT ship a key
  // store. We only submit if an explicit private key was provided;
  // otherwise we surface wallet-signing instructions and stop.
  if (!opts.privateKey) {
    throw new PublishError(
      'no signing key. Re-run with --dry-run to inspect the tx, or set MCPXGG_PUBLISH_KEY / --private-key to sign and submit. Alternatively, sign the printed txBytes with your own wallet.',
    );
  }

  const signed = await submitSigned({
    txBytesB64: built.txBytesB64,
    privateKey: opts.privateKey,
    rpcUrl: deps.txConfig.rpcUrl,
    adapter: deps.adapter,
  });
  result.serverObjectId = signed.serverObjectId;
  result.ownerCapId = signed.ownerCapId;
  result.txDigest = signed.txDigest;
  result.explorerUrl = deps.adapter.txExplorerUrl(signed.txDigest);

  // Second PTB: add the tools to the freshly-published shared Server.
  if (signed.serverObjectId && signed.ownerCapId && config.tools.length > 0) {
    const buildToolsTx = deps.buildToolsTx ?? buildAddToolsTx;
    const toolsTx = await buildToolsTx({
      cfg: deps.txConfig,
      sender: opts.senderAddress,
      serverObjectId: signed.serverObjectId,
      ownerCapId: signed.ownerCapId,
      tools: config.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchemaBlobId: toolSchemaBlobIds[t.name]!,
        priceAtomic: t.priceAtomic,
        freeTierCallsPerUser: t.freeTierCallsPerUser,
        timeoutSeconds: t.timeoutSeconds,
      })),
    });
    await submitSigned({
      txBytesB64: toolsTx.txBytesB64,
      privateKey: opts.privateKey,
      rpcUrl: deps.txConfig.rpcUrl,
      adapter: deps.adapter,
    });
  }

  return result;
}

/**
 * Signs + submits a base64 tx. Delegates key handling to `@mcpxgg/chain`
 * (the only package allowed to import `@mysten/sui`); the CLI never touches
 * the SDK directly. The dry-run/test path never reaches here.
 */
async function submitSigned(args: {
  txBytesB64: string;
  privateKey: string;
  rpcUrl: string;
  adapter: ChainAdapter;
}): Promise<{ txDigest: string; serverObjectId?: string; ownerCapId?: string }> {
  let res: Awaited<ReturnType<typeof signAndExecuteBase64Tx>>;
  try {
    res = await signAndExecuteBase64Tx({
      txBytesB64: args.txBytesB64,
      privateKey: args.privateKey,
      rpcUrl: args.rpcUrl,
    });
  } catch (e) {
    throw new PublishError(e instanceof Error ? e.message : String(e));
  }
  let serverObjectId: string | undefined;
  let ownerCapId: string | undefined;
  for (const change of res.created) {
    if (change.objectType.endsWith('::registry::Server')) serverObjectId = change.objectId;
    if (change.objectType.endsWith('::registry::ServerOwnerCap')) ownerCapId = change.objectId;
  }
  return {
    txDigest: res.digest,
    ...(serverObjectId ? { serverObjectId } : {}),
    ...(ownerCapId ? { ownerCapId } : {}),
  };
}
