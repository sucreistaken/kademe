/** The families of a CSS font-family list ("'A', 'A Fallback'" -> ["'A'", "'A Fallback'"]). */
function families(list: string): string[] {
  return list
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * The font stack of an Arabic page, from next/font's two family lists
 * (`font.style.fontFamily`: the web font, then its local "Fallback" face).
 *
 * The order matters because each fallback face is `local(Arial)` with no
 * unicode-range, and Arial has Arabic letters: whatever fallback comes before
 * the Arabic web font would draw the Arabic text. And the Arabic web font ships
 * Latin faces too, so it must come after the Latin web font or it draws the
 * Latin text. Hence: the Latin web font (Latin letters and digits), the Arabic
 * web font (Arabic script; the Latin one has none), then the Arabic fallbacks
 * (most of an Arabic page is Arabic) and the Latin ones, used only while a
 * web font is still loading.
 */
export function arabicFontStack(latin: string, arabic: string): string {
  const [latinFace, ...latinFallbacks] = families(latin);
  const [arabicFace, ...arabicFallbacks] = families(arabic);
  return [latinFace, arabicFace, ...arabicFallbacks, ...latinFallbacks].filter(Boolean).join(", ");
}
