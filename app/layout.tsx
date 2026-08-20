import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Lets relative/asset URLs in metadata resolve correctly, and gives
  // Next.js a base for alternates.canonical below. This app is reachable
  // at both theperpetualhive.com/ImportEase (the public URL) and the raw
  // *.vercel.app deployment URL — the canonical tag tells search engines
  // to consolidate ranking on the public domain rather than treating them
  // as duplicate content.
  metadataBase: new URL("https://theperpetualhive.com"),
  title: "ImportEase",
  description: "Addon tool for Accela Configuration Manager",
  alternates: {
    canonical: "/ImportEase",
  },
  openGraph: {
    title: "ImportEase",
    description: "Addon tool for Accela Configuration Manager",
    url: "/ImportEase",
  },
  twitter: {
    card: "summary",
    title: "ImportEase",
    description: "Addon tool for Accela Configuration Manager",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
