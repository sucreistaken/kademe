"use client";

import { useEffect } from "react";
import { dirOf, type CandidateLocale } from "@/i18n/locale";

/**
 * Copies the candidate's `lang` and `dir` onto <html>. The Shell already sets
 * them on its own wrapper, but dialogs and menus render in a portal under
 * <body>, outside that wrapper, and would otherwise stay left to right in
 * Arabic. The previous values are put back on unmount so the manager panel,
 * which is Turkish, is never left with a student's language.
 */
export function DocumentLocale({ locale }: { locale: CandidateLocale }) {
  useEffect(() => {
    const root = document.documentElement;
    const before = { lang: root.getAttribute("lang"), dir: root.getAttribute("dir") };
    root.setAttribute("lang", locale);
    root.setAttribute("dir", dirOf(locale));
    return () => {
      if (before.lang === null) root.removeAttribute("lang");
      else root.setAttribute("lang", before.lang);
      if (before.dir === null) root.removeAttribute("dir");
      else root.setAttribute("dir", before.dir);
    };
  }, [locale]);
  return null;
}
