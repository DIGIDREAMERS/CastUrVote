import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CastUrVote",
  description: "Secure. Simple. Transparent.",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#147c73"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
