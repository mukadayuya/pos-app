import type { Metadata, Viewport } from "next";
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
  title: "FLOWS — by Infotainment",
  description: "飲食店向けPOSレジアプリ",
};

// LINE内蔵ブラウザ判定などmiddlewareでのUser-Agent分岐を確実に効かせるため、
// 静的ページとしてCDNにキャッシュされず毎回サーバーを通す（force-dynamic）。
// これがないと完全に静的生成されたページがmiddlewareをバイパスしてCDNから
// 直接返され、LINE→外部ブラウザの自動リダイレクトが効かなくなる。
export const dynamic = "force-dynamic";

// LINE内蔵ブラウザ・モバイル各種で確実にビューポート幅に収める設定
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
