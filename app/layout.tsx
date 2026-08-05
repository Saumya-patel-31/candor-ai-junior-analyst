import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Aurora } from "@/components/viz/Aurora";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://candor.local"),
  title: {
    default: "Candor — the AI analyst that knows what it doesn't know",
    template: "%s · Candor",
  },
  description:
    "An autonomous AI research analyst: plans, retrieves SEC filings, synthesizes cited memos, self-critiques, and publishes a public calibration track record. Research/education tool — not investment advice.",
  keywords: ["AI analyst", "equity research", "SEC EDGAR", "RAG", "calibration", "agent"],
  openGraph: {
    title: "Candor — AI Junior Analyst",
    description:
      "Plans, retrieves, cites, self-critiques, and grades its own calibration over time.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(display.variable, sans.variable, mono.variable)}>
      <body className="min-h-screen font-sans antialiased">
        <Aurora />
        <Navbar />
        <main className="relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
