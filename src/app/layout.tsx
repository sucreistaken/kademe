import type { Metadata } from "next";
import { Nunito, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

// A rounded sans for the whole app (user decision 2026-10-14: "soft, nothing
// sharp"). Variable, so every weight from 200 to 1000 comes in one file.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"], // latin-ext carries the Turkish and German glyphs
});

// Nunito has no Arabic glyphs. The Arabic face is used only under :lang(ar)
// (globals.css) and is not preloaded, so Turkish, English, German and Spanish
// pages never download it.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Kademe | Campus German",
  description: "Campus German'ın dil okulları için seviye sınavı ve aday değerlendirme platformu",
  applicationName: "Kademe",
  creator: "Campus German",
  publisher: "Campus German",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${nunito.variable} ${notoArabic.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
