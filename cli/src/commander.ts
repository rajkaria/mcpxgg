/**
 * `mcpxgg` Commander program (S5-T07).
 *
 *   mcpxgg init [dir]      scaffold a new server (config + minimal @mcpxgg/server)
 *   mcpxgg validate [dir]  schema-validate mcpx.config.json, pass/fail report
 *   mcpxgg publish [dir]   the publish flow (S5-T08..T11), --dry-run default
 *
 * The CLI never holds keys. `publish` defaults to --dry-run; a real submit
 * needs --private-key or MCPXGG_PUBLISH_KEY, otherwise it prints the tx for
 * the user to sign with their own wallet.
 */

import { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateConfig } from '@mcpxgg/shared/validation/config-schema';
import { readFile } from 'node:fs/promises';
import { getActiveChain, type SuiTxConfig } from '@mcpxgg/chain';
import { createWalrusClient, walrusEnv } from '@mcpxgg/walrus';
import { runPublish, PublishError, type PublishResult } from './publish.js';

export interface CliIo {
  log: (msg: string) => void;
  error: (msg: string) => void;
}

const defaultIo: CliIo = {
  log: (m) => process.stdout.write(`${m}\n`),
  error: (m) => process.stderr.write(`${m}\n`),
};

/** A complete, schema-valid starter config written by `init`. */
function starterConfig(namespace: string): string {
  return (
    JSON.stringify(
      {
        namespace,
        name: 'My MCP Server',
        description: 'A starter MCP server scaffolded by the mcpxgg CLI. Edit me.',
        category: 'other',
        tags: ['starter'],
        triggerPhrases: ['use my server'],
        endpointUrl: 'https://my-server.example.com',
        tools: [
          {
            name: 'echo',
            description: 'Echoes the input back to the caller.',
            priceAtomic: '1000',
            freeTierCallsPerUser: 3,
            timeoutSeconds: 30,
            inputSchema: {
              type: 'object',
              properties: { message: { type: 'string' } },
              required: ['message'],
            },
          },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}

const starterServer = `import { createMCPXServer } from '@mcpxgg/server';

const server = createMCPXServer({ namespace: 'NAMESPACE' });

server.tool('echo', {
  description: 'Echoes the input back to the caller.',
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
  },
  pricing: { perCallAtomic: 1_000n },
  handler: async (args) => ({ echo: (args as { message: string }).message }),
});

server.listen(3000);
`;

const starterReadme = `# NAMESPACE

An MCP server published on [mcpxgg](https://mcpx.gg).

## Develop

\`\`\`
pnpm install
pnpm dev
\`\`\`

## Publish

\`\`\`
npx mcpxgg validate
npx mcpxgg publish --dry-run
\`\`\`
`;

async function cmdInit(dir: string, io: CliIo): Promise<number> {
  const target = resolve(dir);
  const namespace =
    target
      .split('/')
      .filter(Boolean)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'my-server';
  const safeNs = namespace.length < 3 ? `${namespace}-mcp` : namespace;

  await mkdir(join(target, 'src'), { recursive: true });

  const configPath = join(target, 'mcpx.config.json');
  if (existsSync(configPath)) {
    io.error(`refusing to overwrite existing ${configPath}`);
    return 1;
  }
  await writeFile(configPath, starterConfig(safeNs), 'utf8');
  await writeFile(
    join(target, 'src', 'index.ts'),
    starterServer.replace('NAMESPACE', safeNs),
    'utf8',
  );
  await writeFile(join(target, 'README.md'), starterReadme.replaceAll('NAMESPACE', safeNs), 'utf8');

  io.log(`Scaffolded mcpxgg server in ${target}`);
  io.log(`  mcpx.config.json   (namespace: ${safeNs})`);
  io.log(`  src/index.ts       (@mcpxgg/server)`);
  io.log(`  README.md`);
  io.log('');
  io.log('Next:  cd into it, then `npx mcpxgg validate` and `npx mcpxgg publish --dry-run`.');
  return 0;
}

async function cmdValidate(dir: string, io: CliIo): Promise<number> {
  const path = join(resolve(dir), 'mcpx.config.json');
  if (!existsSync(path)) {
    io.error(`FAIL  mcpx.config.json not found in ${resolve(dir)}`);
    return 1;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    io.error(`FAIL  mcpx.config.json is not valid JSON: ${String(e)}`);
    return 1;
  }
  const result = validateConfig(parsed);
  if (result.valid) {
    const ns = (parsed as { namespace?: string }).namespace ?? '(unknown)';
    const tools = Array.isArray((parsed as { tools?: unknown[] }).tools)
      ? (parsed as { tools: unknown[] }).tools.length
      : 0;
    io.log(`PASS  ${path}`);
    io.log(`      namespace: ${ns}`);
    io.log(`      tools:     ${tools}`);
    return 0;
  }
  io.error(`FAIL  ${path}`);
  for (const err of result.errors) io.error(`  - ${err}`);
  return 1;
}

function suiTxConfigFromEnv(): SuiTxConfig | undefined {
  const packageId = process.env.MCPX_PACKAGE_ID;
  const sessionRegistryId = process.env.MCPX_REGISTRY_ID;
  const coinType = process.env.USDSUI_COIN_TYPE ?? '0x2::usdsui::USDSUI';
  const rpcUrl = process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443';
  if (!packageId || !sessionRegistryId) return undefined;
  return { packageId, sessionRegistryId, coinType, rpcUrl };
}

function printPublishResult(r: PublishResult, io: CliIo): void {
  io.log('');
  io.log(`Uploaded ${r.uploads.length} blob(s) to Walrus:`);
  for (const u of r.uploads) io.log(`  ${u.name}  →  ${u.blobId} (${u.size}B)`);
  io.log('');
  if (r.dryRun) {
    io.log('DRY RUN — nothing submitted. Assembled publish_server tx:');
    io.log(`  metadataBlobId: ${r.metadataBlobId}`);
    io.log(`  txBytes (base64, sign with your wallet):`);
    io.log(`  ${r.txBytesB64}`);
    io.log('');
    io.log('To submit: re-run without --dry-run and set MCPXGG_PUBLISH_KEY,');
    io.log('or sign the txBytes above with your own Sui wallet.');
    return;
  }
  io.log('PUBLISHED');
  io.log(`  server_object_id: ${r.serverObjectId}`);
  io.log(`  owner_cap_id:     ${r.ownerCapId}`);
  io.log(`  tx digest:        ${r.txDigest}`);
  io.log(`  explorer:         ${r.explorerUrl}`);
}

async function cmdPublish(
  dir: string,
  flags: { dryRun: boolean; skipHealth: boolean; address?: string; privateKey?: string },
  io: CliIo,
): Promise<number> {
  const senderAddress = flags.address ?? process.env.MCPXGG_PUBLISH_ADDRESS;
  if (!senderAddress) {
    io.error(
      'FAIL  no publisher address. Pass --address <0x..> or set MCPXGG_PUBLISH_ADDRESS.',
    );
    return 1;
  }
  const txConfig = suiTxConfigFromEnv();
  if (!txConfig) {
    io.error(
      'FAIL  set MCPX_PACKAGE_ID and MCPX_REGISTRY_ID (and optionally SUI_RPC_URL, USDSUI_COIN_TYPE).',
    );
    return 1;
  }
  const privateKey = flags.privateKey ?? process.env.MCPXGG_PUBLISH_KEY;
  try {
    const result = await runPublish(
      {
        dir: resolve(dir),
        dryRun: flags.dryRun,
        skipHealth: flags.skipHealth,
        senderAddress,
        privateKey,
      },
      {
        adapter: getActiveChain(),
        walrus: createWalrusClient(walrusEnv()),
        healthCheck: async (url) => {
          const res = await fetch(url, { method: 'GET' });
          return { ok: res.ok, status: res.status };
        },
        txConfig,
      },
    );
    printPublishResult(result, io);
    return 0;
  } catch (e) {
    if (e instanceof PublishError) {
      io.error(`FAIL  ${e.message}`);
      for (const d of e.detail ?? []) io.error(`  - ${d}`);
      return 1;
    }
    io.error(`FAIL  ${String(e)}`);
    return 1;
  }
}

export function buildProgram(io: CliIo = defaultIo): Command {
  const program = new Command();
  program
    .name('mcpxgg')
    .description('mcpxgg CLI — scaffold, validate, and publish MCP servers on Sui')
    .version('0.1.0');

  program
    .command('init')
    .argument('[dir]', 'target directory', '.')
    .description('scaffold a new MCP server (mcpx.config.json + @mcpxgg/server)')
    .action(async (dir: string) => {
      process.exitCode = await cmdInit(dir, io);
    });

  program
    .command('validate')
    .argument('[dir]', 'directory containing mcpx.config.json', '.')
    .description('schema-validate mcpx.config.json')
    .action(async (dir: string) => {
      process.exitCode = await cmdValidate(dir, io);
    });

  program
    .command('publish')
    .argument('[dir]', 'directory containing mcpx.config.json', '.')
    .description('validate, upload to Walrus, and assemble the publish PTB')
    .option('--no-dry-run', 'actually sign + submit (needs a signing key)')
    .option('--skip-health', 'skip the endpoint /health probe', false)
    .option('--address <addr>', 'publisher Sui address (or MCPXGG_PUBLISH_ADDRESS)')
    .option('--private-key <key>', 'ed25519 key to sign+submit (or MCPXGG_PUBLISH_KEY)')
    .action(
      async (
        dir: string,
        opts: { dryRun: boolean; skipHealth: boolean; address?: string; privateKey?: string },
      ) => {
        process.exitCode = await cmdPublish(
          dir,
          {
            dryRun: opts.dryRun,
            skipHealth: opts.skipHealth,
            ...(opts.address ? { address: opts.address } : {}),
            ...(opts.privateKey ? { privateKey: opts.privateKey } : {}),
          },
          io,
        );
      },
    );

  return program;
}
