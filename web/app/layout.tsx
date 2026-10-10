import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { SPLASH_GUARD } from "@/lib/splash";
import { THEME_GUARD } from "@/lib/theme";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Lume",
    default: "Lume: electricity supply you can check",
  },
  description:
    "Lume checks the hours of electricity each feeder delivers against its NERC band, bills from verified supply, and flags meters that look tampered with.",
  openGraph: {
    siteName: "Lume",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme and splash guards set data-* on <html> before React hydrates.
    <html lang="en" className={`${archivo.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_GUARD + SPLASH_GUARD }} />
      </head>
      <body className="min-h-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
