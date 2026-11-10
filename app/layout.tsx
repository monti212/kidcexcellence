import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/kidcellence/SiteHeader";
import { SiteFooter } from "@/components/kidcellence/SiteFooter";
import { SiteAnalyticsTracker } from "@/components/SiteAnalyticsTracker";

// Kidcellence typeface. Exposed as --kc-font, which --font-sans in globals.css uses.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--kc-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kidcellence | Botswana Childcare Marketplace",
  description:
    "Find, compare, message, and verify trusted childcare providers across Botswana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-sans">
        <SiteAnalyticsTracker />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
