import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"], // latin-ext carries the Turkish glyphs
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kademe",
  description: "Yapılandırılmış aday değerlendirme platformu",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
