import { describe, expect, it } from "vitest";
import { CANDIDATE_LOCALES } from "@/i18n/locale";
import { SEED_BANK } from "@/db/seed-bank/index";
import { isFormatTopic, TAG_ALIASES, TOPICS, topicLabel, topicOf } from "./topics";

describe("topicOf", () => {
  it("strips the section prefix, lower-cases and applies aliases", () => {
    expect(topicOf("grammar.konnektoren")).toBe("konnektor");
    expect(topicOf("Reading.Gist")).toBe("gist");
    expect(topicOf("listening.attitude")).toBe("attitude");
    expect(topicOf("writing.dativ")).toBe("dativ");
    expect(topicOf("speaking.perfekt")).toBe("perfekt");
    expect(topicOf("dativ")).toBe("dativ");
  });
  it("keeps dotted subtopic ids and returns unknown ids bare", () => {
    expect(topicOf("grammar.genitiv.praeposition")).toBe("genitiv.praeposition");
    expect(topicOf("grammar.nonsense")).toBe("nonsense");
  });
  it("does not trip on inherited object keys", () => {
    expect(topicOf("constructor")).toBe("constructor");
    expect(topicLabel("constructor", "en")).toBeNull();
  });
});

describe("TAG_ALIASES", () => {
  it("resolves every alias to a catalog id", () => {
    for (const [from, to] of Object.entries(TAG_ALIASES)) {
      expect(TOPICS[to], `${from} -> ${to}`).toBeDefined();
    }
  });
});

describe("topicLabel", () => {
  it("returns the label in the student's language", () => {
    expect(topicLabel("grammar.konnektoren", "de")).toBe("Konnektoren");
    expect(topicLabel("dativ", "tr")).toBe("Dativ");
  });
  it("falls back to en when the locale label is empty, without touching TOPICS", () => {
    const catalog = { dativ: { label: { ...TOPICS.dativ.label, es: "" } } };
    expect(topicLabel("dativ", "es", { catalog })).toBe(TOPICS.dativ.label.en);
    expect(TOPICS.dativ.label.es).not.toBe("");
  });
  it("returns null for an unknown id", () => {
    expect(topicLabel("grammar.nonsense", "en")).toBeNull();
  });
  it("rolls a subtopic up to its parent only when asked", () => {
    expect(topicLabel("genitiv.praeposition", "en")).toBe("Genitive prepositions");
    expect(topicLabel("genitiv.praeposition", "en", { rollUp: true })).toBe("Prepositions");
    expect(topicLabel("dativ", "en", { rollUp: true })).toBe("Dative");
  });
});

describe("TOPICS", () => {
  it("has five non-empty labels without em dashes and resolvable parents", () => {
    for (const [id, topic] of Object.entries(TOPICS)) {
      if (topic.parent) expect(TOPICS[topic.parent], `${id} parent`).toBeDefined();
      for (const locale of CANDIDATE_LOCALES) {
        const label = topic.label[locale];
        expect(label?.trim(), `${id}.${locale}`).toBeTruthy();
        expect(label).not.toContain(String.fromCharCode(0x2014));
      }
    }
  });
});

describe("catalog completeness", () => {
  const items = SEED_BANK.items;

  it("resolves every GRAMMAR, READING and LISTENING seed skill tag to a TOPICS id", () => {
    const tags = new Set(items.filter((i) => ["GRAMMAR", "READING", "LISTENING"].includes(i.section)).map((i) => i.skillTag));
    expect(tags.size).toBeGreaterThan(50);
    for (const tag of tags) expect(TOPICS[topicOf(tag)], tag).toBeDefined();
  });

  it("resolves every seed gap topic to a non-format TOPICS id (guard for the bank authors)", () => {
    for (const i of items) {
      if (i.key.kind !== "GAP" || !i.key.topics) continue;
      for (const [gap, topic] of Object.entries(i.key.topics)) {
        const id = topicOf(topic);
        expect(TOPICS[id], `${i.skillTag} ${gap}: ${topic}`).toBeDefined();
        expect(TOPICS[id].format, `${i.skillTag} ${gap}: ${topic} is a format`).toBeUndefined();
      }
    }
  });

  it("marks exactly the four task formats as format entries", () => {
    const formats = Object.entries(TOPICS).filter(([, t]) => t.format).map(([id]) => id).sort();
    expect(formats).toEqual(["cloze", "ctest", "open", "wordbank"]);
    expect(isFormatTopic("grammar.cloze")).toBe(true);
    expect(isFormatTopic("grammar.ctest")).toBe(true);
    expect(isFormatTopic("grammar.dativ")).toBe(false);
    expect(isFormatTopic("grammar.nonsense")).toBe(false);
  });

  it("keeps a canonical id for every alias and no alias that shadows a catalog id", () => {
    for (const from of Object.keys(TAG_ALIASES)) expect(TOPICS[from], `${from} shadows a catalog id`).toBeUndefined();
  });

  it("uses ASCII ids", () => {
    for (const id of Object.keys(TOPICS)) expect(id).toMatch(/^[a-z0-9_.]+$/);
  });

  it("carries the corrected review labels", () => {
    expect(TOPICS.konjunktiv_i.label.ar).not.toMatch(/الشرط/);
    expect(TOPICS.konjunktiv2.label.ar).not.toMatch(/الشرط/);
    expect(TOPICS.modalverb.label.ar).not.toContain("المساعدة");
    expect(TOPICS.dativ.label.ar).toContain("الجر");
    expect(TOPICS.akkusativ.label.ar).toContain("النصب");
    expect(TOPICS["genitiv.praeposition"].label.ar).toBe("حروف الجر مع الجينيتيف");
    expect(TOPICS.wechselpraeposition.label.es).toBe("Preposiciones de doble caso");
    expect(TOPICS.wechselpraeposition.label.tr).toBe("Dativ/Akkusativ edatları (Wechselpräpositionen)");
  });
});
