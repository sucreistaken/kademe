import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ objects: new Map<string, { mime: string; bytes: number }>() }));

vi.mock("@/db", () => ({ db: new Proxy({}, { get: () => () => { throw new Error("database reached"); } }) }));
vi.mock("@/lib/tts", () => ({ synthesize: vi.fn(), ttsAvailable: () => false }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    openStream: async (key: string) => {
      if (!store.objects.has(key)) throw new Error("not found");
      return { bytes: 1, totalBytes: 1, stream: new Response(new Uint8Array([1])).body };
    },
    putObject: async (key: string, mime: string, body: Uint8Array) => {
      store.objects.set(key, { mime, bytes: body.byteLength });
      return { bytes: body.byteLength };
    },
  }),
}));

import { img } from "@/db/seed-bank/image";
import type { ItemContent } from "@/lib/exam/types";
import { ensureSeedImages } from "./bank-import";

const contents: ItemContent[] = [
  { kind: "CHOICE", options: [{ id: "a", text: "", image: img("obj.activity.cooking") }, { id: "b", text: "", image: img("obj.activity.football") }, { id: "c", text: "x" }] },
  { kind: "SPEAKING", thinkSeconds: 10, answerSeconds: 30, maxTakes: 1, images: [img("obj.activity.cooking")] },
];

beforeEach(() => store.objects.clear());

describe("ensureSeedImages", () => {
  it("uploads each missing referenced picture once, as image/webp, through the storage abstraction", async () => {
    const lines: string[] = [];
    const r = await ensureSeedImages(contents, (m) => lines.push(m));
    expect(r).toEqual({ uploaded: 2, present: 0 });
    expect([...store.objects.keys()].sort()).toEqual([img("obj.activity.cooking").storageKey, img("obj.activity.football").storageKey].sort());
    for (const o of store.objects.values()) {
      expect(o.mime).toBe("image/webp");
      expect(o.bytes).toBeGreaterThan(1000);
    }
    expect(lines).toEqual(["  images: 2 uploaded, 0 already in storage"]);
  });

  it("is idempotent: a second run uploads nothing", async () => {
    await ensureSeedImages(contents);
    expect(await ensureSeedImages(contents)).toEqual({ uploaded: 0, present: 2 });
  });

  it("uploads only what is missing and says nothing when no item uses a picture", async () => {
    store.objects.set(img("obj.activity.cooking").storageKey, { mime: "image/webp", bytes: 5 });
    expect(await ensureSeedImages(contents)).toEqual({ uploaded: 1, present: 1 });
    const lines: string[] = [];
    expect(await ensureSeedImages([{ kind: "SHORT_TEXT", maxChars: 5 }], (m) => lines.push(m))).toEqual({ uploaded: 0, present: 0 });
    expect(lines).toEqual([]);
  });
});
