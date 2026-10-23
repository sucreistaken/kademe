import { describe, expect, it } from "vitest";
import { CANDIDATE_LOCALES } from "@/i18n/locale";
import { TAG_ALIASES, TOPICS, topicLabel, topicOf } from "./topics";

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
  it("falls back to en when the locale label is empty", () => {
    const saved = TOPICS.dativ.label.es;
    TOPICS.dativ.label.es = "";
    try {
      expect(topicLabel("dativ", "es")).toBe(TOPICS.dativ.label.en);
    } finally {
      TOPICS.dativ.label.es = saved;
    }
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
