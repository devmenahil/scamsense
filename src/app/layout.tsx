import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { SkipLink } from "@/components/layout/SkipLink";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ScamSense: practise spotting scams before you pay",
    template: "%s · ScamSense",
  },
  description:
    "ScamSense is an educational financial-scam simulator. Practise realistic, fictional scenarios, explain your decisions, and learn the safest next step. No real money, no real data.",
};

export const viewport: Viewport = {
  themeColor: "#0B5F66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US" className={`${nunito.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
