import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata API — 對應 US-11 SEO。
 * Next 會把這些放進 <head>：title、description、og:image 等。
 */
export const metadata: Metadata = {
  title: {
    default: "光明牙醫診所 — 讓笑容更燦爛",
    template: "%s | 光明牙醫診所",
  },
  description:
    "專業、溫暖、值得信賴的牙醫團隊。提供一般牙科、植牙、矯正、美學牙科、兒童牙科等完整療程。",
  keywords: ["牙醫", "牙醫診所", "信義區牙醫", "植牙", "矯正", "美白", "兒童牙科"],
  openGraph: {
    title: "光明牙醫診所",
    description: "讓笑容更燦爛的鄰里牙醫",
    locale: "zh_TW",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
