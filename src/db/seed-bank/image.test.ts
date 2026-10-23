import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANK_IMAGE_KEY } from "@/lib/exam/image-refs";
import type { ItemContent } from "@/lib/exam/types";
import manifest from "./images/manifest.json";
import { img, seedImageFiles, seedImageFilesUsedBy } from "./image";

describe("img()", () => {
  it("returns a content addressed reference with the manifest's size and alt text", () => {
    const e = manifest.images.find((i) => i.id === "obj.activity.cooking")!;
    expect(img("obj.activity.cooking")).toEqual({ storageKey: `bank/images/${e.sha16}.webp`, w: e.w, h: e.h, alt: e.alt });
  });

  it("throws on an unknown id and names it", () => {
    expect(() => img("nope.nothing")).toThrow(/nope\.nothing/);
  });

  it("every catalog picture has a valid key, alt text and a file whose bytes are webp", () => {
    for (const e of manifest.images) {
      const ref = img(e.id);
      expect(ref.storageKey, e.id).toMatch(BANK_IMAGE_KEY);
      expect(ref.alt.trim(), e.id).not.toBe("");
    }
    const files = seedImageFiles();
    expect(files).toHaveLength(manifest.images.length);
    expect(new Set(files.map((f) => f.storageKey)).size).toBe(files.length);
    for (const f of files) {
      expect(f.mime).toBe("image/webp");
      expect(existsSync(f.path), f.path).toBe(true);
    }
    const head = readFileSync(files[0].path).subarray(0, 12);
    expect(head.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(head.subarray(8, 12).toString("latin1")).toBe("WEBP");
  });
});

describe("seedImageFilesUsedBy", () => {
  it("returns each used file once and nothing else", () => {
    const a = img("obj.activity.cooking");
    const b = img("obj.activity.football");
    const contents: ItemContent[] = [
      { kind: "CHOICE", options: [{ id: "a", text: "", image: a }, { id: "b", text: "", image: b }, { id: "c", text: "x" }] },
      { kind: "SPEAKING", thinkSeconds: 10, answerSeconds: 30, maxTakes: 1, images: [a] },
      { kind: "SHORT_TEXT", maxChars: 10 },
    ];
    expect(seedImageFilesUsedBy(contents).map((f) => f.storageKey).sort()).toEqual([a.storageKey, b.storageKey].sort());
    expect(seedImageFilesUsedBy([])).toEqual([]);
  });
});
