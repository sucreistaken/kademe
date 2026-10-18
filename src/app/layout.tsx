import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Nunito, Noto_Sans_Arabic } from "next/font/google";
import { arabicFontStack } from "@/lib/font-stack";
import "./globals.css";

// A rounded sans for the whole app (user decision 2026-10-14: "soft, nothing
// sharp"). Variable, so every weight from 200 to 1000 comes in one file.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"], // latin-ext carries the Turkish and German glyphs
});

// Nunito has no Arabic glyphs. The Arabic face is used only under :lang(ar)
// (globals.css) and is not preloaded, so Turkish, English, German and Spanish
// pages never download it. What the build really ships (checked in the built
// CSS, 2026-10-18): the family also has Latin, math and symbol faces
// (`subsets` only picks what is preloaded), and a "Noto Sans Arabic Fallback"
// face on local Arial is still emitted although adjustFontFallback is off.
// Nunito has its own Arial "Nunito Fallback" too, and Arial has Arabic letters.
// So the Arabic page's stack is built from the two family lists (--font-arabic,
// set on <html> below, `arabicFontStack`): Nunito, then Noto Sans Arabic, then
// the Arial fallbacks. Latin text stays in Nunito, Arabic text in Noto.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  preload: false,
  adjustFontFallback: false,
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
    <html
      lang="tr"
      className={`${nunito.variable} ${notoArabic.variable} h-full antialiased`}
      style={{ "--font-arabic": arabicFontStack(nunito.style.fontFamily, notoArabic.style.fontFamily) } as CSSProperties}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
