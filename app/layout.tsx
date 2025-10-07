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
  title: "科技资讯聚合 - 全球最新科技互联网资讯",
  description: "实时聚合全球科技新闻，涵盖 TechCrunch、Hacker News、Product Hunt 等顶级科技媒体，提供最新、最全面的科技资讯。",
  keywords: ["科技新闻", "科技资讯", "互联网", "创业", "TechCrunch", "Hacker News", "Product Hunt"],
  authors: [{ name: "Tech News Aggregator" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
