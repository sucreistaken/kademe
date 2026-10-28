import { describe, expect, it } from "vitest";
import authEn from "@/i18n/messages/auth.en.json";
import authDe from "@/i18n/messages/auth.de.json";
import authTr from "@/i18n/messages/auth.tr.json";
import candidateTr from "@/i18n/messages/candidate.tr.json";
import candidateEn from "@/i18n/messages/candidate.en.json";
import candidateDe from "@/i18n/messages/candidate.de.json";
import candidateEs from "@/i18n/messages/candidate.es.json";
import candidateAr from "@/i18n/messages/candidate.ar.json";
import managerTr from "@/i18n/messages/manager.tr.json";
import managerEn from "@/i18n/messages/manager.en.json";
import settingsTr from "@/i18n/messages/settings.tr.json";
import settingsEn from "@/i18n/messages/settings.en.json";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";
import libraryTr from "@/i18n/messages/library.tr.json";
import libraryEn from "@/i18n/messages/library.en.json";
import hiringTr from "@/i18n/messages/hiring.tr.json";
import hiringEn from "@/i18n/messages/hiring.en.json";
import advancedTr from "@/i18n/messages/advanced.tr.json";
import advancedEn from "@/i18n/messages/advanced.en.json";
import managerDe from "@/i18n/messages/manager.de.json";
import settingsDe from "@/i18n/messages/settings.de.json";
import screensDe from "@/i18n/messages/screens.de.json";
import libraryDe from "@/i18n/messages/library.de.json";
import hiringDe from "@/i18n/messages/hiring.de.json";
import advancedDe from "@/i18n/messages/advanced.de.json";

/**
 * A key present in one locale and missing in the other renders as the raw key
 * in front of a user. The types catch it at the top level, but only this walks
 * every leaf, and the manager dictionary is edited by several people at once.
 */
function leafKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** A leaf's value by its dotted path. */
function valueAt(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dict);
}

/**
 * The argument names and rich tags an ICU message needs from its caller:
 * `{name}`, `{count, plural, ...}` (the branch bodies are walked too) and tags
 * such as `<b>`. A translation that drops or renames one renders a raw
 * `{name}` or throws at runtime. Only names count, not the argument type:
 * Turkish takes `{count}` where English needs a plural, and Arabic adds
 * branches (few, many) the source never had.
 */
function icuPlaceholders(message: string): string[] {
  const found = new Set<string>();
  for (const tag of message.matchAll(/<\/?([a-zA-Z][\w-]*)>/g)) found.add(`<${tag[1]}>`);
  /** Index just past the brace that closes the one at `open`. */
  const close = (text: string, open: number) => {
    let depth = 0;
    for (let j = open; j < text.length; j += 1) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}" && --depth === 0) return j + 1;
    }
    return text.length;
  };
  const walk = (text: string) => {
    let i = 0;
    while (i < text.length) {
      if (text[i] !== "{") {
        i += 1;
        continue;
      }
      const end = close(text, i);
      const inner = text.slice(i + 1, end - 1);
      const [name, type] = inner.split(",").map((part) => part.trim());
      found.add(name);
      if (type === "plural" || type === "select" || type === "selectordinal") {
        // Options look like `one {...} other {...}`: walk every body.
        const options = inner.slice(inner.indexOf(",", inner.indexOf(",") + 1) + 1);
        let k = 0;
        while (k < options.length) {
          if (options[k] !== "{") {
            k += 1;
            continue;
          }
          const bodyEnd = close(options, k);
          walk(options.slice(k + 1, bodyEnd - 1));
          k = bodyEnd;
        }
      }
      i = end;
    }
  };
  walk(message);
  return [...found].sort();
}

const CANDIDATE_TRANSLATIONS: Array<[string, unknown]> = [
  ["en", candidateEn],
  ["de", candidateDe],
  ["es", candidateEs],
  ["ar", candidateAr],
];

const PAIRS: Array<[string, unknown, unknown]> = [
  ["candidate", candidateTr, candidateEn],
  ["manager", managerTr, managerEn],
  ["settings", settingsTr, settingsEn],
  ["screens", screensTr, screensEn],
  ["library", libraryTr, libraryEn],
  ["hiring", hiringTr, hiringEn],
  ["advanced", advancedTr, advancedEn],
];

describe("dictionaries", () => {
  it.each(PAIRS)("%s tr and en have the same keys", (_name, tr, en) => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(tr).sort());
  });

  /**
   * Other tasks add keys to candidate.tr.json and candidate.en.json; this fails
   * naming every file and key that has to follow (copy the English text into
   * de/es/ar until it is translated).
   */
  it.each(CANDIDATE_TRANSLATIONS)("candidate.%s.json has exactly the keys of candidate.tr.json", (name, dict) => {
    const source = new Set(leafKeys(candidateTr));
    const have = new Set(leafKeys(dict));
    const missing = [...source].filter((key) => !have.has(key)).sort();
    const extra = [...have].filter((key) => !source.has(key)).sort();
    const report = [
      ...(missing.length ? [`candidate.${name}.json is missing ${missing.length} key(s) present in candidate.tr.json: ${missing.join(", ")}`] : []),
      ...(extra.length ? [`candidate.${name}.json has ${extra.length} key(s) not in candidate.tr.json: ${extra.join(", ")}`] : []),
    ];
    expect(report, report.join("\n")).toEqual([]);
  });

  it.each(CANDIDATE_TRANSLATIONS)("candidate.%s.json keeps the ICU placeholders and tags of candidate.tr.json", (name, dict) => {
    const report: string[] = [];
    for (const key of leafKeys(candidateTr)) {
      const source = valueAt(candidateTr, key);
      const translated = valueAt(dict, key);
      if (typeof source !== "string" || typeof translated !== "string") continue;
      const want = icuPlaceholders(source);
      const got = icuPlaceholders(translated);
      if (want.join("|") !== got.join("|")) {
        report.push(`candidate.${name}.json "${key}": expected placeholders [${want.join(", ")}] but found [${got.join(", ")}]`);
      }
    }
    expect(report, report.join("\n")).toEqual([]);
  });

  it("icuPlaceholders reads arguments, plural branches and rich tags", () => {
    expect(icuPlaceholders("Hello {name}, <b>{count, plural, one {# file} other {# files}}</b>")).toEqual(["<b>", "count", "name"]);
    expect(icuPlaceholders("{n, plural, one {{who} has one} other {{who} has #}}")).toEqual(["n", "who"]);
    expect(icuPlaceholders("No placeholders here")).toEqual([]);
  });

  it("manager namespaces do not collide across files", () => {
    const names = [managerTr, settingsTr, screensTr, libraryTr, hiringTr, advancedTr].flatMap((file) =>
      Object.keys(file as Record<string, unknown>),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("no message is left empty", () => {
    for (const [name, tr, en] of PAIRS) {
      const dicts = name === "candidate" ? [tr, en, candidateDe, candidateEs, candidateAr] : [tr, en];
      for (const dict of dicts) {
        const empty = leafKeys(dict).filter((key) => {
          const value = key
            .split(".")
            .reduce<unknown>(
              (node, part) => (node as Record<string, unknown>)?.[part],
              dict,
            );
          return typeof value === "string" && value.trim() === "";
        });
        expect(empty, `${name}`).toEqual([]);
      }
    }
  });

  it("says an opening is a hiring opening, not a role (the EN word 'role' already means the user's role)", () => {
    expect(hiringEn.hiringOpenings.noPermission).toBe("Your role cannot open a hiring opening.");
  });

  it("heads the invite preview without saying every row will be saved (marked rows are not)", () => {
    expect(hiringTr.hiringInvite.previewTitle).toBe("Listeden okunan adaylar");
    expect(hiringEn.hiringInvite.previewTitle).toBe("Candidates read from your list");
  });

  it("no message contains an em dash (HIRING-UX E5)", () => {
    for (const [name, tr, en] of PAIRS) {
      expect(JSON.stringify([tr, en]), name).not.toContain("\u2014");
    }
    for (const [name, dict] of CANDIDATE_TRANSLATIONS) {
      expect(JSON.stringify(dict), `candidate.${name}`).not.toContain("\u2014");
    }
  });
});

/**
 * The panel speaks German too (owner 2026-10-23). Until the translation pass the
 * German files are copies of the English ones; either way they must follow the
 * Turkish key set, keep every ICU placeholder and tag, and stay free of empty
 * strings and em dashes.
 */
describe("panel German dictionaries", () => {
  const DE: Array<[string, unknown, unknown]> = [
    ["manager", managerTr, managerDe],
    ["settings", settingsTr, settingsDe],
    ["screens", screensTr, screensDe],
    ["library", libraryTr, libraryDe],
    ["hiring", hiringTr, hiringDe],
    ["advanced", advancedTr, advancedDe],
  ];

  it.each(DE)("%s.de.json has exactly the keys of %s.tr.json", (name, tr, de) => {
    const source = new Set(leafKeys(tr));
    const have = new Set(leafKeys(de));
    const missing = [...source].filter((key) => !have.has(key)).sort();
    const extra = [...have].filter((key) => !source.has(key)).sort();
    const report = [
      ...(missing.length ? [`${name}.de.json is missing ${missing.length} key(s): ${missing.join(", ")}`] : []),
      ...(extra.length ? [`${name}.de.json has ${extra.length} key(s) not in ${name}.tr.json: ${extra.join(", ")}`] : []),
    ];
    expect(report, report.join("\n")).toEqual([]);
  });

  it.each(DE)("%s.de.json keeps the ICU placeholders and tags of %s.tr.json", (name, tr, de) => {
    const report: string[] = [];
    for (const key of leafKeys(tr)) {
      const source = valueAt(tr, key);
      const translated = valueAt(de, key);
      if (typeof source !== "string" || typeof translated !== "string") continue;
      const want = icuPlaceholders(source);
      const got = icuPlaceholders(translated);
      if (want.join("|") !== got.join("|")) {
        report.push(`${name}.de.json "${key}": expected placeholders [${want.join(", ")}] but found [${got.join(", ")}]`);
      }
    }
    expect(report, report.join("\n")).toEqual([]);
  });

  it.each(DE)("%s.de.json has no empty string and no em dash", (name, _tr, de) => {
    const empty = leafKeys(de).filter((key) => {
      const value = valueAt(de, key);
      return typeof value === "string" && value.trim() === "";
    });
    expect(empty, name).toEqual([]);
    expect(JSON.stringify(de), name).not.toContain("\u2014");
  });
});

/**
 * The sign-in and setup screens speak the panel's three languages. English is the source;
 * the others follow key for key and keep its placeholders, and nothing Turkish
 * may survive in a language other than Turkish (school review: "Dile rağmen
 * metinlerde Türkçe çıktısı var").
 */
describe("auth dictionaries", () => {
  const OTHERS = [
    ["de", authDe],
    ["tr", authTr],
  ] as const;

  it.each(OTHERS)("auth.%s.json has exactly the keys of auth.en.json", (_name, dict) => {
    expect(leafKeys(dict).sort()).toEqual(leafKeys(authEn).sort());
  });

  it.each(OTHERS)("auth.%s.json keeps the placeholders of auth.en.json", (_name, dict) => {
    for (const key of leafKeys(authEn)) {
      const source = icuPlaceholders(String(valueAt(authEn, key))).sort();
      expect(icuPlaceholders(String(valueAt(dict, key))).sort(), key).toEqual(source);
    }
  });

  it.each([
    ["en", authEn],
    ["de", authDe],
  ] as const)("auth.%s.json has no Turkish letters", (_name, dict) => {
    for (const key of leafKeys(dict)) {
      expect(String(valueAt(dict, key)), key).not.toMatch(/[çğışİÇĞŞ]/);
    }
  });
});

describe("the candidate exam says Mark, never Flag (owner 2026-10-23)", () => {
  it.each(["examNav", "cheatWarning"] as const)("no English %s string contains the word flag", (group) => {
    const offenders = leafKeys(candidateEn[group], group)
      .filter((key) => /flag/i.test(String(valueAt(candidateEn, key))));
    expect(offenders).toEqual([]);
  });
});
