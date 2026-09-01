import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perpetual Hive | Accela Pages",
  description: "Custom Accela pages by Perpetual Hive",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
