import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));

import { SEED_PARTS } from "@/db/seed-bank";
import { TaskExpectations } from "./TaskExpectations";
import { TaskPromptCard } from "./TaskPromptCard";

const render = (text: string, points?: string[]) => renderToStaticMarkup(createElement(TaskPromptCard, { text, points }));

const prompts = [...SEED_PARTS.writing.items, ...SEED_PARTS.speaking.items].map((i) => i.prompt);
const find = (re: RegExp) => {
  const p = prompts.find((x) => re.test(x));
  if (!p) throw new Error(`no seed prompt for ${re}`);
  return p;
};

/** The roles on the card, in reading order. */
const roles = (html: string) => [...html.matchAll(/data-role="(\w+)"/g)].map((m) => m[1]);
/** The element that carries a role, up to its closing tag (the card nests no element of the same role). */
const roleBlock = (html: string, role: string) => html.match(new RegExp(`<div[^>]*data-role="${role}"[^>]*>[^]*?</div>(?:</div>)?`))?.[0] ?? "";
const heavy = /font-(?:semibold|bold|extrabold|black)\b/g;

describe("the task card's typographic hierarchy", () => {
  const nina = find(/Freundin Nina/);
  const html = render(nina);

  it("reads situation, label, task, points, note, in that order", () => {
    expect(roles(html)).toEqual(["situation", "task", "items", "note"]);
    expect(html.indexOf("Sie haben eine neue Arbeit.")).toBeLessThan(html.indexOf("taskHeading"));
    expect(html.indexOf("taskHeading")).toBeLessThan(html.indexOf("Schreiben Sie Ihrer Freundin Nina eine Nachricht"));
    expect(html.indexOf("Nachricht (circa 30 Wörter)")).toBeLessThan(html.indexOf("Wo arbeiten Sie jetzt?"));
    expect(html.indexOf("Wann arbeiten Sie?")).toBeLessThan(html.indexOf("Schreiben Sie auch eine Anrede und einen Gruß."));
  });

  it("sets the situation at 17px regular", () => {
    const box = roleBlock(html, "situation");
    expect(box).toContain("text-[17px]");
    expect(box).toContain("font-normal");
    expect(box).not.toMatch(heavy);
  });

  it("sets the task, and only the task, in semibold 17px", () => {
    const task = roleBlock(html, "task");
    expect(task).toContain("text-[17px] font-semibold");
    // One heavy run on the whole card: no bold-regular-bold.
    expect(html.match(heavy)).toHaveLength(1);
  });

  it("sets the points in regular weight at 16px, one gap between items, bullets drawn as dots", () => {
    const list = html.slice(html.indexOf('data-role="items"') - 140, html.indexOf("Wann arbeiten Sie?"));
    expect(list).toContain("<ul");
    expect(list).toContain("text-[16px]");
    expect(list).toContain("gap-2");
    expect(list).not.toMatch(heavy);
    expect(html.match(/rounded-full bg-ink-3/g)).toHaveLength(3);
  });

  it("sets the note after the points in regular weight, like the points", () => {
    const note = roleBlock(html, "note");
    expect(note).toContain("Schreiben Sie auch eine Anrede und einen Gruß.");
    expect(note).toContain("font-normal");
    expect(note).not.toMatch(heavy);
  });

  it("puts the label over the task in the interface language, not in the German card's words", () => {
    expect(html).toMatch(/<div lang="en" dir="ltr" class="[^"]*">taskHeading<\/div>/);
  });
});

describe("a form task", () => {
  const form = find(/Maria Costa möchte/);
  const html = render(form);

  it("lists the fields as numbers beside names, in regular weight", () => {
    const list = html.slice(html.lastIndexOf("<ol"));
    expect(list).toContain('data-role="items"');
    for (const [i, name] of ["Familienname", "Straße und Hausnummer", "Postleitzahl und Wohnort"].entries()) {
      expect(list).toContain(`${i + 1}.</span><span class="min-w-0">${name}</span>`);
    }
    expect(list).not.toMatch(heavy);
    expect(list).toContain("tnum");
  });

  it("sets the example line in muted italics, apart from the instruction", () => {
    expect(html).toMatch(/<p class="[^"]*italic[^"]*text-muted[^"]*" data-role="example">&quot;1\. Familienname: \.\.\.&quot;<\/p>/);
    // The instruction that carries it is regular, not semibold.
    expect(html).toMatch(/<p class="font-normal text-ink-2">Schreiben Sie immer die Nummer und die Angabe, zum Beispiel:<\/p>/);
  });

  it("keeps the main task line semibold and everything below it regular", () => {
    const task = roleBlock(html, "task");
    expect(task).toContain("font-semibold");
    expect(html.slice(html.indexOf('data-role="items"')).match(heavy)).toBeNull();
  });
});

describe("a speaking picture task", () => {
  const picture = find(/Diese Fragen helfen Ihnen/);
  const html = render(picture);

  it("shows the task lines in semibold, the lead-in and the questions in regular weight", () => {
    expect(roles(html)).toEqual(["task", "text", "items"]);
    expect(roleBlock(html, "task")).toContain("font-semibold");
    expect(roleBlock(html, "task")).toContain("Sehen Sie das Bild an.");
    expect(html.slice(html.indexOf('data-role="text"')).match(heavy)).toBeNull();
    expect(html).toContain("Diese Fragen helfen Ihnen:");
  });

  it("gives the task label to the first task only", () => {
    expect(html.match(/taskHeading/g)).toHaveLength(1);
  });
});

describe("a speaking card task", () => {
  const card = find(/Auf Ihrer Karte steht/);
  const html = render(card);

  it("keeps the topic and the card, then the task under its label", () => {
    expect(html).toContain("Thema");
    expect(html).toContain("text-[26px]");
    expect(html.indexOf("Mittagspause?")).toBeLessThan(html.indexOf("taskHeading"));
  });
});

describe("every real seed prompt", () => {
  it("renders with at most one task label and no more than one situation box before the task", () => {
    for (const p of prompts) {
      const html = render(p);
      expect((html.match(/taskHeading/g) ?? []).length, p).toBeLessThanOrEqual(1);
      expect(html, p).not.toContain("undefined");
    }
  });

  it("is never semibold after the points that follow its task", () => {
    for (const p of prompts) {
      const html = render(p);
      const r = roles(html);
      const at = r.findIndex((role, i) => role === "items" && r[i - 1] === "task");
      if (at < 0) continue;
      // Everything after that list has no heavy weight (a second task block would show as one).
      const after = html.slice(html.indexOf('data-role="items"', html.indexOf('data-role="task"')) + 1);
      expect(after.match(heavy), p).toBeNull();
    }
  });

  it("keeps every word of the prompt on the card", () => {
    const letters = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&quot;|&#x27;|&amp;/g, "").replace(/\s\d+\.(?=<)/g, "").replace(/[^\p{L}]/gu, "");
    for (const p of prompts.filter((x) => !x.includes("|"))) {
      const text = letters(render(p));
      const words = p.match(/\p{L}{4,}/gu) ?? [];
      for (const w of words) expect(text, `${w} in ${p}`).toContain(w.replace(/[^\p{L}]/gu, ""));
    }
  });
});

describe("the assessment box", () => {
  const writing = renderToStaticMarkup(createElement(TaskExpectations, { section: "WRITING", minWords: 30, maxWords: 40 }));
  const speaking = renderToStaticMarkup(createElement(TaskExpectations, { section: "SPEAKING", thinkSeconds: 30, answerSeconds: 60 }));

  it("is the quietest box: 13 to 14px, no border, no heavier than semibold", () => {
    for (const html of [writing, speaking]) {
      expect(html).not.toContain("border");
      expect(html).not.toMatch(/text-\[1[5-9]px\]|text-\[2\d px\]/);
      expect(html).toContain("text-[13.5px]");
      expect(html).not.toMatch(/font-(?:bold|extrabold|black)/);
      expect(html).toContain('data-role="assessment"');
    }
  });

  it("still says the length or the times and what is looked at", () => {
    expect(writing).toContain("assessTitle");
    expect(writing).toContain("assessOrganised");
    expect(speaking).toContain("assessPronunciation");
  });

  it("lists the criteria in two columns from small width, to stay short", () => {
    expect(speaking).toContain("sm:grid-cols-2");
  });
});
