import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = __dirname;
const EM_DASH = String.fromCharCode(0x2014);

interface Entry {
  id: string;
  file: string;
  sha16: string;
  w: number;
  h: number;
  alt: string;
  kind: "object" | "scene" | "chart";
  category: string;
  levels: string[];
  sourceUrl: string;
  license: string;
  author: string;
}

const manifest: { images: Entry[] } = JSON.parse(
  fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"),
);

const OBJECTS: Record<string, string[]> = {
  transport: ["bus", "train", "bicycle", "car", "taxi", "tram"],
  weather: ["sunny", "rainy", "snowy", "windy", "cloudy"],
  food: ["bread-rolls", "apples", "cheese", "coffee", "tea", "pizza", "soup", "cake"],
  place: [
    "bakery",
    "pharmacy",
    "supermarket",
    "post-office",
    "train-station",
    "library",
    "doctor-waiting-room",
    "cinema",
    "swimming-pool",
    "restaurant",
  ],
  activity: ["swimming", "reading", "cooking", "jogging", "football", "guitar", "gardening", "hiking"],
  clothes: ["jacket", "shoes", "dress", "sweater", "hat-scarf"],
  home: ["sofa", "bed", "table-chairs", "lamp", "washing-machine", "fridge"],
  thing: ["book", "flowers", "watch", "handbag", "umbrella"],
};

const SCENES: Record<string, string[]> = {
  a1: ["family-breakfast", "market", "park", "cafe", "supermarket-checkout"],
  a2: ["train-platform", "moving-house", "birthday-party", "doctor-waiting", "cooking-together"],
  b1: ["home-office", "city-cycling", "open-air-concert", "volunteers", "library-study-group"],
  b2: ["team-meeting", "waste-sorting", "crowded-tram", "senior-with-tablet", "car-sharing"],
  c1: ["urban-garden", "factory-robots", "tourist-crowd", "video-call", "telemedicine"],
  c2: ["traffic-and-bike-lane", "art-museum", "phones-at-dinner", "wind-farm", "coworking"],
};

/** Charts we draw ourselves (SVG, German labels), by level. */
const CHARTS: Record<string, string[]> = {
  c1: ["energie", "medien", "tourismus"],
};

const EXPECTED_IDS = [
  ...Object.entries(CHARTS).flatMap(([lvl, names]) => names.map((n) => `chart.${lvl}.${n}`)),
  ...Object.entries(OBJECTS).flatMap(([cat, names]) => names.map((n) => `obj.${cat}.${n}`)),
  ...Object.entries(SCENES).flatMap(([lvl, names]) => names.map((n) => `scene.${lvl}.${n}`)),
];

describe("bank image manifest", () => {
  it("has unique ids, sorted", () => {
    const ids = manifest.images.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it("covers the whole catalog and nothing else", () => {
    const ids = manifest.images.map((e) => e.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
    expect(EXPECTED_IDS).toHaveLength(83 + Object.values(CHARTS).flat().length);
  });

  it.each(manifest.images.map((e) => [e.id, e] as const))("%s is a valid entry", (_id, e) => {
    const file = path.join(DIR, e.file);
    expect(fs.existsSync(file)).toBe(true);
    const bytes = fs.readFileSync(file);
    // WebP container: "RIFF" .... "WEBP"
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(createHash("sha256").update(bytes).digest("hex").slice(0, 16)).toBe(e.sha16);
    expect(e.w).toBeGreaterThan(0);
    expect(e.h).toBeGreaterThan(0);
    expect(e.w).toBeLessThanOrEqual(1600);
    expect(e.alt.trim().length).toBeGreaterThan(0);
    expect(e.alt).not.toContain(EM_DASH);
    expect(e.sourceUrl.startsWith("https://")).toBe(true);
    if (e.id.startsWith("chart.")) {
      expect(e.license).toBe("Original (Kademe)");
      expect(e.sourceUrl).toBe("https://kademe.kadiray.com/original");
    }
    expect(e.license.length).toBeGreaterThan(0);
    expect(e.author.length).toBeGreaterThan(0);
    expect(e.levels.length).toBeGreaterThan(0);
    expect(e.kind).toBe(e.id.startsWith("scene.") ? "scene" : e.id.startsWith("chart.") ? "chart" : "object");
  });

  it("keeps the folder small and free of em dashes", () => {
    const total = fs
      .readdirSync(DIR)
      .reduce((sum, f) => sum + fs.statSync(path.join(DIR, f)).size, 0);
    expect(total).toBeLessThanOrEqual(12 * 1024 * 1024);
    expect(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")).not.toContain(EM_DASH);
  });
});
