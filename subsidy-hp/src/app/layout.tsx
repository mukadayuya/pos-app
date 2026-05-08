import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Infotainment | AI×補助金で飲食店の利益を最大化する",
  description: "AIによる業務自動化・次世代店舗DX・補助金戦略支援をワンストップで提供。飲食店オーナーの事務負担を軽減し、本業に集中できる環境をつくります。",
  other: {
    "google": "notranslate",
  },
  verification: {
    google: "HHf89tpdtIUPq89MWdPHcYQFR5Lq4nTyVJ8Jj9-YBzc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
