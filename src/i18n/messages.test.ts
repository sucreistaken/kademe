import { describe, expect, it } from "vitest";
import candidateTr from "@/i18n/messages/candidate.tr.json";
import candidateEn from "@/i18n/messages/candidate.en.json";
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
  ["library", libraryTr, libraryEn],
  ["hiring", hiringTr, hiringEn],
  ["advanced", advancedTr, advancedEn],
];

describe("dictionaries", () => {
  it.each(PAIRS)("%s tr and en have the same keys", (_name, tr, en) => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(tr).sort());
  });

  it("manager namespaces do not collide across files", () => {
    const names = [managerTr, settingsTr, screensTr, libraryTr, hiringTr, advancedTr].flatMap((file) =>
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
  });
});
