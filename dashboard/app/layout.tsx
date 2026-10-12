import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = {
  title: "AgencyForge — AI Creative Agency",
  description: "AI Creative Agency Operating System — Research, Design, Build, Deploy, Grow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}