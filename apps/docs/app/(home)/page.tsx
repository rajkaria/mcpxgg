import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-24">
      <p className="mb-3 text-sm font-medium text-fd-primary">
        On-chain MCP marketplace · Sui mainnet
      </p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">MCPX Docs</h1>
      <p className="mb-8 text-lg text-fd-muted-foreground">
        Every MCP tool call settles in USDsui through an x402 facilitator.
        Receipts are soulbound on-chain. Developers earn straight to a Sui
        DeveloperVault. No tokens, no credit cards — stablecoin revenue from
        day one.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/docs/quickstart/user"
          className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        >
          5-minute quickstart
        </Link>
        <Link
          href="/docs"
          className="rounded-lg border px-5 py-2.5 font-medium"
        >
          Read the docs
        </Link>
        <Link
          href="/blog/mcpx-is-mainnet-on-sui"
          className="rounded-lg border px-5 py-2.5 font-medium"
        >
          MCPX is mainnet →
        </Link>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        <Card
          title="Quickstart"
          href="/docs/quickstart/user"
          body="Connect Privy, recharge $1, call a tool, see the receipt — or publish a server and earn."
        />
        <Card
          title="Core concepts"
          href="/docs/concepts/sessions"
          body="Sessions, Vaults, Receipts, Intents, Bundles, Insurance, SLA Staking, streaming."
        />
        <Card
          title="SDK reference"
          href="/docs/sdk/client"
          body="@mcpxgg/sdk, @mcpxgg/server, @mcpxgg/widget — the real, shipped API surface."
        />
        <Card
          title="x402 + Move"
          href="/docs/x402/spec"
          body="The exact & upto facilitator schemes, and all 13 on-chain Move modules."
        />
      </div>
    </main>
  );
}

function Card({
  title,
  href,
  body,
}: {
  title: string;
  href: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-5 transition-colors hover:bg-fd-accent"
    >
      <h2 className="mb-1 font-semibold">{title}</h2>
      <p className="text-sm text-fd-muted-foreground">{body}</p>
    </Link>
  );
}
