import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MigrationWelcome } from "@/components/MigrationWelcome";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpx.gg";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MCPX — The on-chain MCP marketplace, settled in USDsui",
    template: "%s | MCPX",
  },
  description:
    "Browse, enable, and call any MCP server with one API key. Every tool call settles on-chain in USDsui on Sui — no subscriptions, no credits, permanent receipts.",
  applicationName: "MCPX",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "Sui",
    "USDsui",
    "x402",
    "AI agents",
    "MCP marketplace",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "MCPX",
    url: SITE_URL,
    title: "MCPX — The on-chain MCP marketplace, settled in USDsui",
    description:
      "Every MCP tool call settles on-chain in USDsui on Sui. One API key, permanent receipts, developers earn straight to a Sui vault.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCPX — The on-chain MCP marketplace, settled in USDsui",
    description:
      "Every MCP tool call settles on-chain in USDsui on Sui. One API key, permanent receipts.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          {children}
          <MigrationWelcome />
        </Providers>
      </body>
    </html>
  );
}
