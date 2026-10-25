import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackOverview } from "@/server/exam-feedback";

/** The students' feedback overview, with the session, the language and the store faked. */
vi.mock("@/db", () => ({ db: {} }));
const s = vi.hoisted(() => ({
  locale: "de" as "tr" | "en" | "de",
  orgId: "org-7",
  asked: [] as string[],
  overview: null as unknown,
}));
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: s.orgId, email: "", name: "", role: "REVIEWER" }) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => s.locale }));
vi.mock("@/server/exam-feedback", () => ({
  feedbackOverview: async (orgId: string) => {
    s.asked.push(orgId);
    return s.overview;
  },
}));

import ExamFeedbackPage from "./page";

const overview = (over: Partial<FeedbackOverview> = {}): FeedbackOverview => ({
  count: 4,
  averageOverall: 4.25,
  averageClarity: 4,
  averageUsability: 3.5,
  technicalAnswered: 4,
  technicalYes: 1,
  comments: [
    { id: "f1", assessmentId: "a-1", name: "Ada Lovelace", overall: 2, technicalProblem: true, comment: "Der Ton fiel nach der Pause aus.", locale: "de", createdAt: new Date("2026-10-25T09:30:00Z") },
    { id: "f2", assessmentId: "a-2", name: null, overall: 5, technicalProblem: false, comment: "Alles klar.\nDanke.", locale: "en", createdAt: new Date("2026-10-24T09:30:00Z") },
  ],
  ...over,
});

async function render() {
  return renderToStaticMarkup(await ExamFeedbackPage());
}

beforeEach(() => {
  s.locale = "de";
  s.orgId = "org-7";
  s.asked = [];
  s.overview = overview();
});

describe("the feedback overview page", () => {
  it("reads the signed-in user's organisation and nothing else", async () => {
    await render();
    expect(s.asked).toEqual(["org-7"]);
    s.orgId = "org-9";
    await render();
    expect(s.asked).toEqual(["org-7", "org-9"]);
  });

  it("shows the count, the average, the two sub averages and the technical share, in German", async () => {
    const html = await render();
    expect(html).toContain("Rückmeldungen der Prüflinge");
    expect(html).toMatch(/Antworten<\/dt><dd[^>]*>4</);
    // 4.25 reads 4,3 in German; the technical share is 1 of 4 = 25 %.
    expect(html).toContain("4,3 von 5");
    expect(html).toContain("4,0 von 5");
    expect(html).toContain("3,5 von 5");
    expect(html).toContain("25 % (1 von 4)");
  });

  it("lists the newest comments with the rating, the technical flag and a link to the result", async () => {
    const html = await render();
    expect(html).toContain("Neueste Kommentare");
    expect(html).toContain("Der Ton fiel nach der Pause aus.");
    expect(html).toContain("Technisches Problem gemeldet");
    expect(html).toContain("2 von 5");
    expect(html).toContain('href="/exam/students/a-1"');
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Ohne Namen");
    // A comment keeps its own language, for the reader and the screen reader.
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="auto"');
  });

  it("flags a technical problem only on the comment that reported one", async () => {
    const html = await render();
    expect(html.match(/Technisches Problem gemeldet/g)).toHaveLength(1);
  });

  it("points back to Advanced, where the page lives, and adds no menu item of its own", async () => {
    const html = await render();
    expect(html).toContain('href="/advanced"');
    expect(html).toContain("Erweitert");
  });

  it("says plainly that nobody has answered yet instead of showing empty numbers", async () => {
    s.overview = overview({ count: 0, averageOverall: null, averageClarity: null, averageUsability: null, technicalAnswered: 0, technicalYes: 0, comments: [] });
    const html = await render();
    expect(html).toContain("Noch keine Rückmeldungen");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("NaN");
  });

  it("shows a dash for the technical share when nobody answered that question", async () => {
    s.overview = overview({ technicalAnswered: 0, technicalYes: 0, comments: [] });
    const html = await render();
    expect(html).toContain("Noch keine Kommentare.");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("% (0 von 0)");
  });

  it.each(["tr", "en", "de"] as const)("renders in %s without a raw key or an em dash", async (locale) => {
    s.locale = locale;
    const html = await render();
    expect(html).not.toMatch(/examFeedback\./);
    expect(html).not.toContain("\u2014");
    expect(html).toContain({ tr: "Öğrenci geri bildirimleri", en: "Student feedback", de: "Rückmeldungen der Prüflinge" }[locale]);
  });
});
