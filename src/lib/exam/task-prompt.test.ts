import { describe, expect, it } from "vitest";
import { SEED_PARTS } from "@/db/seed-bank";
import { coverPointsFor, isTaskLine, layoutTaskBlocks, parseTaskPrompt, promptListsTasks, splitTaskPrompt, type ParsedTaskPrompt, type TaskSegment } from "./task-prompt";

/** Every letter and digit of a prompt, in order (list numbers excluded, the list draws them): what must survive the layout. */
const letters = (s: string) => s.replace(/^\s*\d+[.)]\s+/gmu, "").replace(/[^\p{L}\p{N}]/gu, "");

function rebuilt(p: ParsedTaskPrompt): string {
  return [
    p.topic ? `Thema ${p.topic}` : "",
    p.card ? `${p.card.lead} ${p.card.text}` : "",
    ...p.blocks.map((b) => (b.kind === "text" ? b.lines.join(" ") : b.items.join(" "))),
  ].join(" ");
}

describe("parseTaskPrompt", () => {
  it("turns a speaking card prompt into topic, card and instruction", () => {
    const p = parseTaskPrompt('Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"\n\nStellen Sie einer Kollegin eine Frage mit diesem Wort. Dann antworten Sie selbst auf Ihre Frage.');
    expect(p.topic).toBe("Arbeit");
    expect(p.card).toEqual({ lead: "Auf Ihrer Karte steht:", text: "Mittagspause?" });
    expect(p.blocks).toEqual([{ kind: "text", lines: ["Stellen Sie einer Kollegin eine Frage mit diesem Wort.", "Dann antworten Sie selbst auf Ihre Frage."] }]);
  });

  it("makes dash lines a list and keeps the instruction lines around it", () => {
    const p = parseTaskPrompt("Erzählen Sie von Ihrem Tag:\n\n- Wann stehen Sie auf?\n- Was machen Sie am Abend?\n\nSchreiben Sie 20 bis 30 Wörter.");
    expect(p.topic).toBeNull();
    expect(p.card).toBeNull();
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Erzählen Sie von Ihrem Tag:"] },
      { kind: "list", ordered: false, items: ["Wann stehen Sie auf?", "Was machen Sie am Abend?"] },
      { kind: "text", lines: ["Schreiben Sie 20 bis 30 Wörter."] },
    ]);
  });

  it("starts a list right after a sentence that ends in a colon", () => {
    const p = parseTaskPrompt("Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n- Meinung.\n- Beispiele.");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter).", "Gehen Sie auf die folgenden Punkte ein:"] },
      { kind: "list", ordered: false, items: ["Meinung.", "Beispiele."] },
    ]);
  });

  it("does not split inside quotation marks or after abbreviations", () => {
    const p = parseTaskPrompt("Ein Kollege sagt: „Großraumbüros sind modern. Einzelbüros nicht mehr.“ Reagieren Sie (z. B. mit einem Beispiel). Danke.");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Ein Kollege sagt: „Großraumbüros sind modern. Einzelbüros nicht mehr.“", "Reagieren Sie (z. B. mit einem Beispiel).", "Danke."] },
    ]);
  });

  it("makes numbered lines an ordered list", () => {
    const p = parseTaskPrompt("Sprechen Sie über diese fünf Punkte:\n\n1. Stellen Sie das Thema vor.\n2. Nennen Sie Vor- und Nachteile.");
    expect(p.blocks[1]).toEqual({ kind: "list", ordered: true, items: ["Stellen Sie das Thema vor.", "Nennen Sie Vor- und Nachteile."] });
  });

  it("reads inline ' - ' points as a list", () => {
    const p = parseTaskPrompt("Sprechen Sie über - Name - Wohnort - Hobbys");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Sprechen Sie über"] },
      { kind: "list", ordered: false, items: ["Name", "Wohnort", "Hobbys"] },
    ]);
  });

  it("keeps a plain one-line prompt as one line", () => {
    expect(parseTaskPrompt("Beschreiben Sie Ihren Tag.")).toEqual({ topic: null, card: null, blocks: [{ kind: "text", lines: ["Beschreiben Sie Ihren Tag."] }] });
  });

  it("returns nothing for an empty prompt", () => {
    expect(parseTaskPrompt("")).toEqual({ topic: null, card: null, blocks: [] });
  });

  it("loses no words on any real seed writing or speaking prompt", () => {
    const items = [...SEED_PARTS.writing.items, ...SEED_PARTS.speaking.items];
    expect(items.length).toBeGreaterThan(50);
    for (const item of items) {
      const p = parseTaskPrompt(item.prompt);
      expect(letters(rebuilt(p)), item.prompt).toBe(letters(item.prompt));
      expect(p.blocks.every((b) => (b.kind === "text" ? b.lines.length > 0 : b.items.length > 0))).toBe(true);
    }
  });

  it("finds the card on every real seed card prompt", () => {
    const cards = SEED_PARTS.speaking.items.filter((i) => /Auf \w+ \p{L}+ steht/u.test(i.prompt));
    expect(cards.length).toBeGreaterThan(0);
    for (const item of cards) {
      const p = parseTaskPrompt(item.prompt);
      expect(p.card, item.prompt).not.toBeNull();
      expect(p.topic, item.prompt).not.toBeNull();
    }
  });
});

describe("splitTaskPrompt (moved here from review-cards)", () => {
  it("still splits the topic from the card", () => {
    expect(splitTaskPrompt('Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"')).toEqual(["Thema: Arbeit.", 'Auf Ihrer Karte steht: "Mittagspause?"']);
  });
});

describe("isTaskLine", () => {
  it("accepts polite imperatives, also after a connecting word", () => {
    for (const l of ["Bitten Sie Herrn Braun um den Kuli.", "Sagen Sie auch danke.", "Stellen Sie sich bitte vor.", "Dann antworten Sie selbst auf Ihre Frage.", "Schreiben Sie 20 bis 30 Wörter."]) {
      expect(isTaskLine(l), l).toBe(true);
    }
  });

  it("rejects situation lines, modal questions and relative clauses", () => {
    for (const l of ["Sie sind im Büro.", "Sie helfen ihr mit dem Formular.", "Können Sie mir bitte helfen?", "Ihr Kollege, den Sie gut kennen, ist krank.", "Ihre Kollegin möchte trainieren."]) {
      expect(isTaskLine(l), l).toBe(false);
    }
  });
});

describe("layoutTaskBlocks", () => {
  const layout = (prompt: string) => layoutTaskBlocks(parseTaskPrompt(prompt).blocks);

  it("puts the situation in one segment and the task lines in a task list", () => {
    expect(layout("Sie sind im Büro. Sie haben keinen Kuli. Ihr Kollege Herr Braun hat einen Kuli.\n\nBitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.")).toEqual([
      { kind: "situation", lines: ["Sie sind im Büro.", "Sie haben keinen Kuli.", "Ihr Kollege Herr Braun hat einen Kuli."] },
      { kind: "tasks", items: [{ text: "Bitten Sie Herrn Braun um den Kuli.", lists: [] }, { text: "Sagen Sie auch danke.", lists: [] }] },
    ]);
  });

  it("nests the list under a task line that ends in a colon", () => {
    expect(layout("Erzählen Sie von Ihrem Tag:\n\n- wann\n- wo")).toEqual([
      { kind: "tasks", items: [{ text: "Erzählen Sie von Ihrem Tag:", lists: [{ ordered: false, items: ["wann", "wo"] }] }] },
    ]);
  });

  it("keeps a list that does not follow a colon as a list of its own", () => {
    const segs = layout("Schreiben Sie die fünf Angaben.\n\n1. Familienname\n2. Wohnort");
    expect(segs[1]).toEqual({ kind: "list", ordered: true, items: ["Familienname", "Wohnort"] });
  });

  it("leaves a prompt without any task line as plain text", () => {
    expect(layout("Das Wetter ist schön. Wir gehen spazieren.")).toEqual([{ kind: "text", lines: ["Das Wetter ist schön.", "Wir gehen spazieren."] }]);
  });

  it("keeps every word of every real seed prompt, in order", () => {
    const flat = (segs: TaskSegment[]) =>
      segs
        .flatMap((s) =>
          s.kind === "tasks"
            ? s.items.flatMap((i) => [i.text, ...i.lists.flatMap((l) => l.items)])
            : s.kind === "list"
              ? s.items
              : s.lines,
        )
        .join(" ");
    const blocksFlat = (p: ParsedTaskPrompt) => p.blocks.map((b) => (b.kind === "text" ? b.lines.join(" ") : b.items.join(" "))).join(" ");
    let withTasks = 0;
    for (const item of [...SEED_PARTS.writing.items, ...SEED_PARTS.speaking.items]) {
      const p = parseTaskPrompt(item.prompt);
      const segs = layoutTaskBlocks(p.blocks);
      expect(flat(segs), item.prompt).toBe(blocksFlat(p));
      if (segs.some((s) => s.kind === "tasks")) withTasks++;
    }
    expect(withTasks).toBeGreaterThan(40);
  });
});

describe("coverPointsFor", () => {
  const points = ["Begrüßung", "einen Grund nennen"];
  const lists = (prompt: string) => promptListsTasks(layoutTaskBlocks(parseTaskPrompt(prompt).blocks));

  it("keeps the points when the prompt is one task with no list", () => {
    expect(coverPointsFor("Sie sind krank. Schreiben Sie Ihrem Chef eine Nachricht.", points)).toEqual(points);
    expect(coverPointsFor("Erzählen Sie von einer schwierigen Situation. Was ist passiert? Wie haben Sie reagiert?", points)).toEqual(points);
  });

  it("drops them when the prompt already lists what to do", () => {
    expect(lists("Schreiben Sie Jan. Gehen Sie auf diese Punkte ein:\n- Dank\n- Frage")).toBe(true);
    expect(lists("Bitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.")).toBe(true);
    expect(lists("Schreiben Sie Nina.\n\n- Wo arbeiten Sie?\n- Was machen Sie bei der Arbeit?")).toBe(true);
    expect(coverPointsFor("Bitten Sie Herrn Braun um den Kuli. Sagen Sie auch danke.", points)).toEqual([]);
  });

  it("does not count a list of material: quotations or sentences to rewrite", () => {
    expect(lists("Halten Sie einen Vortrag zu diesen Aussagen.\n\n1. „Eins.“\n2. „Zwei.“")).toBe(false);
    expect(lists("Formulieren Sie die Sätze um.\n\n1. Obwohl er müde war, kam er. (trotz)\n2. Man kann es nicht ändern. (lässt)")).toBe(false);
  });

  it("gives nothing for missing or blank points", () => {
    expect(coverPointsFor("Schreiben Sie eine Nachricht.", undefined)).toEqual([]);
    expect(coverPointsFor("Schreiben Sie eine Nachricht.", ["  "])).toEqual([]);
  });
});
