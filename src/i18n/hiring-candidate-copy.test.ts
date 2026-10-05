import { describe, expect, it } from "vitest";
import tr from "@/i18n/messages/candidate.tr.json";
import en from "@/i18n/messages/candidate.en.json";

/**
 * HIRING-UX 6 and A10: the hiring candidate screens speak to the candidate as
 * "sen", calmly, and never use the words of suspicion or failure.
 */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
const hiringOf = (dict: Record<string, unknown>) => Object.entries(dict).filter(([name]) => name.startsWith("hiring"));

describe("hiring candidate copy", () => {
  it("has hiring namespaces to check", () => {
    expect(hiringOf(tr).length).toBeGreaterThan(0);
  });

  it.each([
    ["tr", tr, [/uyarı/i, /ihlal/i, /şüpheli/i, /hile/i, /başarısız/i]],
    ["en", en, [/warning/i, /violation/i, /suspicious/i, /cheat/i, /\bfail/i]],
  ] as const)("%s never says warning, violation, suspicious, cheat or fail", (_locale, dict, banned) => {
    for (const [name, namespace] of hiringOf(dict as Record<string, unknown>)) {
      for (const text of strings(namespace)) for (const word of banned) expect(text, `${name}: ${text}`).not.toMatch(word);
    }
  });

  it("speaks to the candidate as sen, never siz", () => {
    const formal = [/(?<!\p{L})siz(?!\p{L})/u, /\p{L}+(?:iniz|ınız|unuz|ünüz)(?!\p{L})/u, /lütfen/iu];
    for (const [name, namespace] of hiringOf(tr)) {
      for (const text of strings(namespace)) for (const pattern of formal) expect(text, `${name}: ${text}`).not.toMatch(pattern);
    }
  });
});
