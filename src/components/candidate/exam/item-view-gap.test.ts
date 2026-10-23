import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));

import type { CandidateItem } from "@/lib/exam/safe";
import { ItemView } from "./ItemView";

function gapItem(attached: boolean): CandidateItem {
  return {
    sequence: 1,
    section: "GRAMMAR",
    type: "GAP_FILL",
    prompt: "Anleitung.\n\nIch b{{g1}} hier und arb{{g2}} gern.",
    content: { kind: "GAP", gaps: [{ id: "g1", choices: null }, { id: "g2", choices: null }], ...(attached ? { attached: true as const } : {}) },
    stimulus: null,
    answer: null,
  };
}

const render = (item: CandidateItem) => renderToStaticMarkup(createElement(ItemView, { item, answer: {}, onChange: () => {} }));

describe("gap items", () => {
  it("C-test: each input sits right after its word stem, unbreakable, without a start margin and sized to the stem", () => {
    const html = render(gapItem(true));
    expect(html).toMatch(/<span>Anleitung\.\n\nIch <\/span><span class="whitespace-nowrap">b<input[^>]*size="2"[^>]*class="ms-0 /);
    expect(html).toMatch(/<span> hier und <\/span><span class="whitespace-nowrap">arb<input[^>]*size="4"/);
    expect(html).not.toContain("mx-1");
  });

  it("an ordinary gap item renders as before", () => {
    const html = render(gapItem(false));
    expect(html).toContain("<span>Anleitung.\n\nIch b</span><input");
    expect(html).toMatch(/<input[^>]*size="8"[^>]*class="mx-1 /);
    expect(html).not.toContain("whitespace-nowrap");
  });

  function typedItem(prompt: string, ids: string[]): CandidateItem {
    return {
      sequence: 1,
      section: "LISTENING",
      type: "GAP_FILL",
      prompt,
      content: { kind: "GAP", gaps: ids.map((id) => ({ id, choices: null })) },
      stimulus: null,
      answer: null,
    };
  }

  it("lays a pipe table out as a real table with an input per marker and no raw pipes", () => {
    const html = render(
      typedItem("Ergänzen Sie die Tabelle.\n\n| Thema | Information |\n|---|---|\n| Ausgrabung begann | {{g1}} |\n| Fundstücke | {{g2}} Stück |", ["g1", "g2"]),
    );
    expect(html).toContain("<table");
    expect(html.match(/<th[ >]/g)).toHaveLength(4);
    expect(html.match(/<input/g)).toHaveLength(2);
    expect(html).toMatch(/<input[^>]*aria-labelledby="[^"]+"/);
    expect(html).toContain("Stück");
    expect(html).not.toContain("|");
    expect(html).not.toContain("{{");
  });

  it("lays bare pipe lines from the bank out as a table (C1 Ausgrabung)", () => {
    const html = render(
      typedItem(
        "Sie hören ein Interview. Ergänzen Sie die Tabelle mit je einem Wort oder einer Zahl.\n\nFund | Angabe | Weiteres\nHolzbrücke | Bäume gefällt zwischen 1190 und {{g1}} | Konservierung dauert etwa {{g2}} Jahre\nMünzen | {{g3}} Silbermünzen | gefunden in einem {{g4}}",
        ["g1", "g2", "g3", "g4"],
      ),
    );
    expect(html).toContain("<table");
    expect(html.match(/<input/g)).toHaveLength(4);
    expect(html).not.toContain("|");
  });

  it("lays label lines out as a form card with one labelled input per row", () => {
    const html = render(
      typedItem("Lesen Sie den Text. Ergänzen Sie die Anmeldekarte.\n\nAnmeldekarte Stadtbibliothek\nFamilienname: {{g1}}\nStraße: {{g2}}\nTelefon: {{g3}}", ["g1", "g2", "g3"]),
    );
    expect(html).not.toContain("<table");
    expect(html).toContain("Anmeldekarte Stadtbibliothek");
    expect(html).toContain("Familienname");
    expect(html.match(/<input/g)).toHaveLength(3);
    expect(html.match(/aria-labelledby=/g)).toHaveLength(3);
    expect(html).toContain('lang="de"');
  });

  it("a plain typed prompt without a table or form renders as before", () => {
    const html = render(typedItem("Ergänzen Sie.\n\nIch wohne in {{g1}} und arbeite in {{g2}}.", ["g1", "g2"]));
    expect(html).not.toContain("<table");
    expect(html).not.toContain("aria-labelledby");
    expect(html).toContain("<span>Ich wohne in </span><input");
  });

  it("gives each input of a cell its own name on top of the row and column labels", () => {
    const html = render(typedItem("Ergänzen Sie.\n\nFund | Angabe\nBrücke | von {{g1}} bis {{g2}}\nKamm | {{g3}}", ["g1", "g2", "g3"]));
    const names = [...html.matchAll(/<input[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    for (const n of names) expect(n.split(" ")).toHaveLength(3);
  });
});
