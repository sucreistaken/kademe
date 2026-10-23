import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));
vi.mock("@/components/candidate/proctor/ProctorProvider", () => ({ useProctor: () => ({ snap: null }) }));
vi.mock("@/components/candidate/LanguagePicker", () => ({ LanguagePicker: () => null }));

import { ExamTopBar } from "./ExamTopBar";

describe("ExamTopBar left group", () => {
  it("truncates a long section name, keeps its full text in title and the counter unshrinkable", () => {
    const name = "Schreiben: Ein formeller Brief an die Hausverwaltung";
    const html = renderToStaticMarkup(
      createElement(ExamTopBar, {
        inQuestion: true,
        sectionName: name,
        counter: "Frage 3 von 20",
        wide: false,
        showLanguagePicker: false,
        lang: "de",
        locales: [],
        proctored: false,
        recLabel: null,
        screenShare: false,
        remainingMs: 600_000,
        sectionMs: 1_200_000,
        token: "t",
        sectionPosition: 1,
      } as never),
    );
    expect(html).toMatch(new RegExp(`<span title="${name}" class="[^"]*\\bmin-w-0\\b[^"]*\\btruncate\\b`));
    expect(html).toContain("max-w-[calc(50%-6rem)]");
    expect(html).toMatch(/<span class="tnum shrink-0 whitespace-nowrap[^"]*">Frage 3 von 20/);
  });
});
