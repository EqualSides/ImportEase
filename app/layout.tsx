import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImportEase",
  description: "Accela Configuration Manager import/export tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
