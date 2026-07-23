import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 5 };
export const metadata: Metadata = {
  title: "QOF Optimiser",
  description: "Benchmark and improve QOF achievement across every clinical domain.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
