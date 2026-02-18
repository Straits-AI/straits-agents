import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://straits-agents-web.mystraits-ai.workers.dev";

export const metadata: Metadata = {
  title: {
    default: "Straits Agents — AI Agents Marketplace",
    template: "%s | Straits Agents",
  },
  description:
    "Deploy, discover, and monetize AI agents with on-chain identity (ERC-8004) and USDC micropayments on BNB Chain.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Straits Agents — AI Agents Marketplace",
    description:
      "Deploy, discover, and monetize AI agents with on-chain identity (ERC-8004) and USDC micropayments on BNB Chain.",
    url: siteUrl,
    siteName: "Straits Agents",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Straits Agents — AI Agents Marketplace",
    description:
      "On-chain AI agent identities, USDC micropayments, no-code builder, and agent-to-agent economy on BNB Chain.",
  },
  robots: { index: true, follow: true },
  other: {
    "theme-color": "#4f46e5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
