import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'MCPX Docs',
    template: '%s — MCPX Docs',
  },
  description:
    'MCPX — the Sui-native on-chain MCP marketplace. Every tool call settles in USDsui via an x402 facilitator; receipts are soulbound on-chain.',
  metadataBase: new URL('https://docs.mcpx.gg'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
