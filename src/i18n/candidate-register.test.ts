import { describe, expect, it } from "vitest";
import de from "@/i18n/messages/candidate.de.json";
import es from "@/i18n/messages/candidate.es.json";
import tr from "@/i18n/messages/candidate.tr.json";

/** The exam addresses the student formally (tr siz, de Sie, es usted). Checks the keys added in the 2026-10 round. */
type Tree = { [key: string]: string | Tree };
const flat = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [[prefix + key, value] as [string, string]] : flat(value, `${prefix}${key}.`)));

const ROUND_KEY = /^(analysis\.|notes\.|tutorial\.|exam\.timeNotice|exam\.pickFull|section\.ruleLISTENINGMixed|examNav\.rule|examItems\.gapLabel)|[Mm]ark/;
const roundCopy = (messages: unknown) => flat(messages as Tree).filter(([key]) => ROUND_KEY.test(key));

const DE_INFORMAL = /(?<![\p{L}])(du|dein|deine|deinen|deinem|deiner|deines|dich|dir)(?![\p{L}])/iu;
const ES_INFORMAL = /(?<![\p{L}])(tú|tu|tus|te|ti|contigo|puedes|tienes|quieres)(?![\p{L}])/iu;
const TR_INFORMAL = /(?<![\p{L}])\p{L}+(?:dın|ların|yın)(?![\p{L}])|(?<![\p{L}])sen(?![\p{L}])/iu;

describe("candidate copy register (formal address)", () => {
  it("covers the round namespaces", () => {
    expect(roundCopy(de).length).toBeGreaterThan(60);
    expect(roundCopy(es).length).toBeGreaterThan(60);
    expect(roundCopy(tr).length).toBeGreaterThan(60);
  });

  it.each([["de", de, DE_INFORMAL], ["es", es, ES_INFORMAL]] as const)("%s has no informal markers", (_locale, messages, pattern) => {
    for (const [key, text] of roundCopy(messages)) expect(text, key).not.toMatch(pattern);
  });

  it("tr analysis has no informal past or possessive endings", () => {
    for (const [key, text] of roundCopy(tr).filter(([k]) => k.startsWith("analysis."))) expect(text, key).not.toMatch(TR_INFORMAL);
  });

  it("catches the informal wording the analysis used before (positive control)", () => {
    expect("Deine Ergebnisse").toMatch(DE_INFORMAL);
    expect("Tus resultados").toMatch(ES_INFORMAL);
    expect("Sonuçların").toMatch(TR_INFORMAL);
    expect("Sonuçlarınız").not.toMatch(TR_INFORMAL);
  });
});
