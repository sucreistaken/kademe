import { describe, expect, it } from "vitest";
import candidateTr from "@/i18n/messages/candidate.tr.json";
import candidateEn from "@/i18n/messages/candidate.en.json";
import managerTr from "@/i18n/messages/manager.tr.json";
import managerEn from "@/i18n/messages/manager.en.json";
import settingsTr from "@/i18n/messages/settings.tr.json";
import settingsEn from "@/i18n/messages/settings.en.json";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";

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

const PAIRS: Array<[string, unknown, unknown]> = [
  ["candidate", candidateTr, candidateEn],
  ["manager", managerTr, managerEn],
  ["settings", settingsTr, settingsEn],
  ["screens", screensTr, screensEn],
];

describe("dictionaries", () => {
  it.each(PAIRS)("%s tr and en have the same keys", (_name, tr, en) => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(tr).sort());
  });

  it("manager namespaces do not collide across the three files", () => {
    const names = [managerTr, settingsTr, screensTr].flatMap((file) =>
      Object.keys(file as Record<string, unknown>),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("no message is left empty", () => {
    for (const [name, tr, en] of PAIRS) {
      for (const dict of [tr, en]) {
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
});
