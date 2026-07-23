import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 5 };
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "QOF Optimiser — benchmark & improve QOF achievement",
    template: "%s · QOF Optimiser",
  },
  description:
    "Benchmark every QOF domain against England, ICB, PCN and peers, see the £ at risk per indicator, and get ranked improvement actions with ready-to-send Accurx questionnaires. Public NHS data only.",
  applicationName: "QOF Optimiser",
  keywords: ["QOF", "Quality and Outcomes Framework", "GP", "general practice", "NHS", "benchmarking", "primary care"],
  openGraph: {
    title: "QOF Optimiser",
    description: "Benchmark and improve QOF achievement across every clinical domain.",
    type: "website",
    locale: "en_GB",
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
