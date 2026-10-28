import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// The screens import the course actions, which import the database: nothing below touches it.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", role: "MANAGER" }) }));
vi.mock("@/lib/exam-results", () => ({ recomputeResult: async () => undefined, finalizeResult: async () => ({ ok: true }) }));
vi.mock("@/server/proctoring", () => ({ recomputeIntegrity: async () => undefined }));

import { managerMessagesFor, managerT } from "@/i18n/manager";
import { defaultCourseRules } from "@/lib/exam/course/catalog";
import { SPEAKING_CRITERIA, WRITING_CRITERIA, type CourseResult, type CourseRubricProposal } from "@/lib/exam/course/types";
import type { ComputedResult } from "@/lib/exam/result";
import { CourseResultPage } from "./course-result-page";
import { courseThresholds, sheetRows } from "./model";
import { OutcomeCard, SheetCard } from "./sheet-cards";
import { SpeakingBlock } from "./speaking-block";
import { WritingBlock } from "./writing-block";
import { GradingPanel, type PanelGrading } from "./grading-panel";

// The real provider types `children` as required, which createElement's third argument cannot satisfy.
const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone?: string; children?: ReactNode }>;
const html = (locale: "de" | "en" | "tr", node: ReactNode) =>
  renderToStaticMarkup(createElement(Provider, { locale, timeZone: "Europe/Berlin", messages: managerMessagesFor(locale) as unknown as Record<string, unknown> }, node));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const ORDER = ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"];
const course = (over: Partial<CourseResult> = {}): CourseResult => ({
  key: "B1",
  form: "A",
  sections: {
    READING: { points: 8, max: 10, pending: false },
    GRAMMAR: { points: 21, max: 25, pending: false },
    LISTENING: { points: 7, max: 10, pending: false },
    WRITING: { points: 6, max: 9, pending: false },
    SPEAKING: { points: null, max: 20, pending: true },
  },
  total: null,
  max: 74,
  pct: null,
  outcome: null,
  reasons: [],
  recommendation: null,
  focus: null,
  ...over,
});

const writingProposal = (): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "WRITING",
  criteria: WRITING_CRITERIA.map((id, i) => ({ id, points: [3, 2, 1][i], max: 3, rationale: `Begründung ${id}` })),
  wordCount: 62,
  leitpunkte: [
    { point: "Interesse nennen und begründen", done: "YES", evidence: "ich möchte mich engagieren, weil" },
    { point: "Zeitbudget nennen", done: "PARTLY", evidence: "ich habe Zeit" },
    { point: "Nach der Schulung fragen", done: "NO", evidence: "" },
  ],
  errors: [{ original: "ich habe gegangen", correction: "ich bin gegangen", type: "GRAMMATIK" }],
  commonErrors: ["SPELLING"],
  advice: "Nebensätze mit weil üben.",
});
const speakingProposal = (): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "SPEAKING",
  criteria: SPEAKING_CRITERIA.map((id, i) => ({ id, points: [3, 3, 2, null, 3][i], max: 4, rationale: `Begründung ${id}` })),
  advice: "Mehr Verbindungswörter.",
});
const grading = (over: Partial<PanelGrading> = {}): PanelGrading => ({
  id: "g1",
  status: "AI_PROPOSED",
  courseProposal: writingProposal(),
  coursePoints: null,
  aiError: null,
  reason: null,
  decidedBy: null,
  updatedAt: new Date("2026-10-28T10:00:00Z"),
  ...over,
});

describe("SheetCard: the section table", () => {
  const render = (locale: "de" | "en", c: CourseResult | null) =>
    html(
      locale,
      createElement(SheetCard, { t: managerT(locale), assessmentId: "a1", rows: sheetRows(ORDER, c, "B1"), total: c?.total ?? null, max: 74, pctText: c?.pct != null ? "70,3" : null, remark: (r) => `Bemerkung ${r.section}` }),
    );

  it("lists the five parts in the sheet's German names with points over maximum and a link to each", () => {
    const out = render("de", course());
    const visible = text(out);
    for (const word of ["Gesamtauswertung", "Prüfungsteil", "max.", "erreicht", "Bemerkung", "Lesen", "Sprachbausteine", "Hören", "Schreiben", "Sprechen", "GESAMT"]) expect(visible, word).toContain(word);
    expect(out).toContain("/exam/students/a1?tab=GRAMMAR");
    expect([...out.matchAll(/<td class="tnum px-3 py-3 text-right text-\[14px\] text-muted">(\d+)<\/td>/g)].map((m) => m[1])).toEqual(["10", "25", "10", "9", "20"]);
  });

  it("marks the part that still waits and shows no points for it", () => {
    const out = render("de", course());
    expect(text(out)).toContain("ausstehend");
    expect(out.match(/ausstehend/g)).toHaveLength(1);
  });

  it("shows the total and its percentage once they exist", () => {
    const out = render("de", course({ total: 52, pct: 70.3, sections: { ...course().sections, SPEAKING: { points: 10, max: 20, pending: false } } }));
    expect(text(out)).toContain("52");
    expect(text(out)).toContain("70,3 %");
    expect(text(out)).not.toContain("ausstehend");
  });

  it("speaks English and Turkish too", () => {
    expect(text(render("en", course()))).toContain("Overall evaluation");
    expect(text(render("en", course()))).toContain("Grammar (Sprachbausteine)");
  });
});

describe("OutcomeCard: Einstufung and Empfehlung", () => {
  const rules = defaultCourseRules("B1");
  const render = (props: Partial<Parameters<typeof OutcomeCard>[0]> = {}, locale: "de" | "en" | "tr" = "de") =>
    html(
      locale,
      createElement(OutcomeCard, {
        t: managerT(locale),
        assessmentId: "a1",
        course: course({ total: 52, pct: 70.3, outcome: "PASS", recommendation: "B2.1" }),
        outcome: "PASS",
        final: false,
        override: null,
        overrideName: "",
        thresholds: courseThresholds(rules, 74, 20),
        speaking: { points: 14, max: 20 },
        max: 74,
        pctText: "70,3",
        canOverride: true,
        reasonMissing: false,
        ...props,
      }),
    );

  it("says Bestanden with the points, the recommended course and the cut scores in points", () => {
    const visible = text(render());
    expect(visible).toContain("Vorläufig: Bestanden");
    expect(visible).toContain("52 / 74 Punkte · 70,3 %");
    expect(visible).toContain("Weiter im Kurs B2.1");
    expect(visible).toContain("Bestehensgrenze: 65 % der Gesamtpunktzahl, das sind 49 von 74 Punkten.");
    expect(visible).toContain("Sprechen: mindestens 12 von 20 Punkten (60 %).");
    expect(visible).toContain("Schreiben, Inhalt 0 Punkte: nicht bestanden");
  });

  it("drops the draft word once final", () => {
    expect(text(render({ final: true }))).not.toContain("Vorläufig");
  });

  it("says Nicht bestanden with the reasons, the next course and the focus, in ink and never red", () => {
    const out = render({
      course: course({ total: 50, pct: 67.6, outcome: "FAIL", reasons: ["SPEAKING_BELOW_MIN"], recommendation: "B1.2", focus: "SPEAKING" }),
      outcome: "FAIL",
      speaking: { points: 9, max: 20 },
    });
    const visible = text(out);
    expect(visible).toContain("Nicht bestanden");
    expect(visible).toContain("Sprechen unter dem Minimum: 9 Punkte, mindestens 12 nötig.");
    expect(visible).toContain("Weiter im Kurs B1.2");
    expect(visible).toContain("Schwerpunkt Sprechen");
    expect(out).not.toMatch(/danger|text-red|bg-red/);
  });

  it("words the other two reasons", () => {
    const visible = text(render({ course: course({ total: 40, pct: 54, outcome: "FAIL", reasons: ["BELOW_PASS", "WRITING_CONTENT_ZERO"] }), outcome: "FAIL" }));
    expect(visible).toContain("Unter der Bestehensgrenze: 40 Punkte, mindestens 49 nötig.");
    expect(visible).toContain("Schreiben, Inhalt: 0 Punkte. Der schriftliche Teil gilt als nicht bestanden.");
  });

  it("is open while a section waits, with no recommendation yet", () => {
    const visible = text(render({ course: course(), outcome: null }));
    expect(visible).toContain("Noch offen");
    expect(visible).toContain("Noch keine Empfehlung.");
  });

  it("names the teacher's decision with the reason, and does not repeat the engine's recommendation when they disagree", () => {
    const visible = text(
      render({
        course: course({ total: 52, pct: 70.3, outcome: "PASS", recommendation: "B2.1" }),
        outcome: "FAIL",
        override: { outcome: "FAIL", reason: "Anwesenheit zu gering", userId: "u1", at: "2026-10-28T10:00:00.000Z" },
        overrideName: "Frau Beispiel",
      }),
    );
    expect(visible).toContain("Frau Beispiel hat das Ergebnis auf Nicht bestanden gesetzt: Anwesenheit zu gering");
    expect(visible).toContain("Die Empfehlung gilt für das berechnete Ergebnis");
    expect(visible).not.toContain("Weiter im Kurs B2.1");
  });

  it("offers the PASS or FAIL decision with a reason only to a teacher who may finalize", () => {
    const out = render();
    expect(out).toContain('name="outcome"');
    expect(out).toContain('name="reason"');
    expect(out).toContain('value="PASS"');
    expect(out).toContain('value="FAIL"');
    expect(render({ canOverride: false })).not.toContain('name="outcome"');
  });

  it("speaks English and Turkish", () => {
    expect(text(render({}, "en"))).toContain("Preliminary: Passed");
    expect(text(render({}, "tr"))).toContain("Ön sonuç: Geçti");
  });
});

describe("GradingPanel", () => {
  const render = (g: PanelGrading, over: { canGrade?: boolean; section?: "WRITING" | "SPEAKING" } = {}) =>
    html("de", createElement(GradingPanel, { t: managerT("de"), grading: g, section: over.section ?? "WRITING", tab: over.section ?? "WRITING", canGrade: over.canGrade ?? true, nameOf: { u1: "Frau Beispiel" } }));

  it("leads with the AI's total over the maximum while undecided, and offers the form", () => {
    const out = render(grading());
    expect(text(out)).toContain("KI-Vorschlag");
    expect(text(out)).toContain("6 / 9");
    expect(out).toContain('name="points.INHALT"');
    expect(text(out)).not.toContain("Punkte ändern");
  });

  it("shows the teacher's total and who confirmed it once decided, with the form behind Punkte ändern", () => {
    const out = render(grading({ status: "CONFIRMED", coursePoints: { points: { INHALT: 3, WORTSCHATZ: 3, GRAMMATIK: 2 } }, decidedBy: "u1" }));
    expect(text(out)).toContain("Lehrkraft");
    expect(text(out)).toContain("8 / 9");
    expect(text(out)).toContain("KI-Vorschlag, bestätigt von Frau Beispiel");
    expect(text(out)).toContain("Punkte ändern");
    expect(out).toContain("<details");
  });

  it("shows the reason of a changed grading", () => {
    const out = render(grading({ status: "OVERRIDDEN", coursePoints: { points: { INHALT: 1, WORTSCHATZ: 1, GRAMMATIK: 1 } }, decidedBy: "u1", reason: "Leitpunkt 3 fehlt" }));
    expect(text(out)).toContain("Geändert von Frau Beispiel: Leitpunkt 3 fehlt");
  });

  it("says the AI is on its way, or failed, and still lets the teacher grade", () => {
    const pending = render(grading({ status: "PENDING", courseProposal: null }));
    expect(text(pending)).toContain("KI-Vorschlag ist unterwegs");
    expect(text(pending)).toContain("Sie können die Punkte selbst vergeben");
    expect(pending).toContain('name="points.INHALT"');
    const failed = render(grading({ status: "AI_FAILED", courseProposal: null, aiError: "unparseable" }));
    expect(text(failed)).toContain("Kein KI-Vorschlag (unparseable). Vergeben Sie die Punkte selbst.");
  });

  it("says when a rule, not the AI, made the zeros", () => {
    const rule: CourseRubricProposal = { ...writingProposal(), byRule: "EMPTY", criteria: WRITING_CRITERIA.map((id) => ({ id, points: 0, max: 3, rationale: "" })) };
    expect(text(render(grading({ courseProposal: rule })))).toContain("Keine Antwort: Die Punkte stammen aus einer festen Regel (0)");
  });

  it("shows plain lines and no form to someone who may not grade", () => {
    const out = render(grading({ status: "CONFIRMED", coursePoints: { points: { INHALT: 3, WORTSCHATZ: 3, GRAMMATIK: 2 } }, decidedBy: "u1" }), { canGrade: false });
    expect(out).not.toContain("<form");
    expect(text(out)).toContain("3 von 3 Punkten");
    expect(render(grading(), { canGrade: false })).not.toContain("<form");
  });

  it("leaves the AUSSPRACHE of a speaking task for the teacher to set", () => {
    const out = render(grading({ courseProposal: speakingProposal() }), { section: "SPEAKING" });
    expect(text(out)).toContain("Aussprache und Verständlichkeit");
    expect(text(out)).toContain("Aus dem Transkript nicht beurteilbar");
    expect(text(out)).toContain("/ 20");
  });
});

describe("WritingBlock", () => {
  const response = {
    id: "rw1",
    answer: { text: "Sehr geehrte Frau Neumann, ich habe gegangen zum Infoabend und möchte mich engagieren." },
    itemSnapshot: { prompt: "Schreiben Sie eine E-Mail an Frau Neumann.", level: "B1" } as never,
  };
  const render = (g: PanelGrading | null) => html("de", createElement(WritingBlock, { t: managerT("de"), response, grading: g, tab: "WRITING", canGrade: true, nameOf: {} }));

  it("shows the task, the text with the AI's error quotes marked, the word count and the AI's own count", () => {
    const out = render(grading());
    expect(text(out)).toContain("Schreiben Sie eine E-Mail an Frau Neumann.");
    expect(out).toContain("<mark");
    expect(out).toContain(">ich habe gegangen</mark>");
    expect(text(out)).toContain("13 Wörter");
    expect(text(out)).toContain("Die KI zählt 62 ohne abgeschriebene Teile.");
  });

  it("shows the Leitpunkt check with a word for each answer, the error list and the advice", () => {
    const visible = text(render(grading()));
    for (const word of ["Leitpunkt-Check", "Interesse nennen und begründen", "Ja", "Teilweise", "Nein", "ich möchte mich engagieren, weil", "Fehlerliste", "ich bin gegangen", "Grammatik", "Förderhinweis", "Nebensätze mit weil üben."]) {
      expect(visible, word).toContain(word);
    }
  });

  it("anchors the task for the checklist's link", () => {
    expect(render(grading())).toContain('id="t-rw1"');
  });

  it("says so when nothing was written", () => {
    const out = html("de", createElement(WritingBlock, { t: managerT("de"), response: { ...response, answer: {} }, grading: grading({ status: "PENDING", courseProposal: null }), tab: "WRITING", canGrade: true, nameOf: {} }));
    expect(text(out)).toContain("Keine Antwort.");
  });
});

describe("SpeakingBlock", () => {
  const response = { id: "rs1", answer: { mediaAssetId: "m1" }, itemSnapshot: { prompt: "Stellen Sie sich vor.", level: "B1" } as never };
  const render = (over: Partial<Parameters<typeof SpeakingBlock>[0]> = {}) =>
    html(
      "de",
      createElement(SpeakingBlock, {
        t: managerT("de"),
        response,
        grading: grading({ courseProposal: speakingProposal() }),
        tab: "SPEAKING",
        canGrade: true,
        nameOf: {},
        index: 2,
        total: 3,
        studentName: "Anna Muster",
        recording: null,
        ...over,
      }),
    );

  it("numbers the task and shows its card and the five criteria", () => {
    const out = render();
    expect(text(out)).toContain("Aufgabe 2 von 3");
    expect(text(out)).toContain("Stellen Sie sich vor.");
    expect(out).toContain('name="points.KOHAERENZ"');
    expect(out).toContain('id="t-rs1"');
  });

  it("says there is no recording when the student did not record", () => {
    expect(text(render())).toContain("Keine Aufnahme.");
  });

  it("shows what a student typed when recording failed", () => {
    const out = render({ response: { ...response, answer: { usedTextAlternative: true, text: "Ich heiße Anna." } } });
    expect(text(out)).toContain("Die lernende Person hat getippt, statt zu sprechen.");
    expect(text(out)).toContain("Ich heiße Anna.");
  });
});

describe("CourseResultPage", () => {
  const user = { id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" } as never;
  const run = (section: string, i: number) => ({ id: `run-${section}`, attemptId: "t1", section, orderIndex: i, startedAt: new Date("2026-10-28T09:00:00Z"), submittedAt: new Date("2026-10-28T09:30:00Z"), completion: "COMPLETED", stopReason: null, thetaMean: null, thetaSd: null, navigable: true, stimulusPlays: {} });
  const writing = { id: "rw1", sectionRunId: "run-WRITING", sequence: 1, answer: { text: "Sehr geehrte Frau Neumann, ich habe gegangen." }, itemSnapshot: { prompt: "E-Mail schreiben.", level: "B1", section: "WRITING" } };
  const speaking = { id: "rs1", sectionRunId: "run-SPEAKING", sequence: 1, answer: {}, itemSnapshot: { prompt: "Stellen Sie sich vor.", level: "B1", section: "SPEAKING" } };
  const dbGrading = (id: string, itemResponseId: string, over: Record<string, unknown>) => ({ id, itemResponseId, status: "AI_PROPOSED", courseProposal: null, coursePoints: null, aiError: null, reason: null, decidedBy: null, updatedAt: new Date("2026-10-28T10:00:00Z"), ...over });

  const view = (over: { computed?: ComputedResult | null; status?: string; gradings?: unknown[]; skillOverrides?: Record<string, unknown>; finalOutcome?: string | null; releasedAt?: Date | null } = {}) =>
    ({
      assessment: { id: "a1", mode: "COURSE_TEST", locale: "de", blueprintSnapshot: { course: { key: "B1", form: "A", rules: defaultCourseRules("B1") }, proctoring: { preset: "OFF" } } },
      candidate: { id: "c1", fullName: "Anna Muster" },
      attempt: { id: "t1", createdAt: new Date("2026-10-28T08:00:00Z"), startedAt: new Date("2026-10-28T09:00:00Z"), completedAt: new Date("2026-10-28T10:00:00Z"), terminatedAt: null, integrityOutcome: null, integritySummary: null },
      result: {
        id: "r1",
        status: over.status ?? "AWAITING_REVIEW",
        computed: over.computed === undefined ? ({ skills: {}, overall: null, pooled: null, status: "AWAITING_REVIEW", verification: null, course: course() } as ComputedResult) : over.computed,
        skillOverrides: over.skillOverrides ?? {},
        finalOutcome: over.finalOutcome ?? null,
        finalizedAt: null,
        releasedAt: over.releasedAt ?? null,
      },
      sections: ORDER,
      runs: ORDER.map(run),
      responses: [writing, speaking],
      gradings: over.gradings ?? [dbGrading("gw", "rw1", { courseProposal: writingProposal() }), dbGrading("gs", "rs1", { courseProposal: speakingProposal() })],
      gradingRevs: [],
      resultRevs: [],
      media: [],
      mediaUrls: {},
      transcripts: [],
      nameOf: {},
    }) as never;
  const row = { status: "AWAITING_REVIEW", integrity: "NONE" } as never;
  const page = async (v: unknown, sp: Record<string, string | undefined> = {}) =>
    html("de", await CourseResultPage({ user, locale: "de", view: v as never, row, problems: [], feedback: null, sp, id: "a1" }));

  it("opens on the marking sheet with the course, the form, the section table and no CEFR level", async () => {
    const out = text(await page(view()));
    expect(out).toContain("Anna Muster");
    expect(out).toContain("Abschlusstest B1 · Form A");
    for (const word of ["Bewertungsbogen", "Gesamtauswertung", "Sprachbausteine", "GESAMT", "Einstufung"]) expect(out, word).toContain(word);
    expect(out).not.toContain("Gesamtniveau");
    expect(out).toContain("ausstehend");
  });

  it("holds the finalize button back and says which tasks wait", async () => {
    const out = await page(view());
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>Ergebnis abschließen/);
    expect(text(out)).toContain("Schreiben: 1 Aufgabe wartet auf Sie");
    expect(text(out)).toContain("Sprechen: 1 Aufgabe wartet auf Sie");
  });

  it("lets the teacher finalize once every task is decided and the engine has an outcome", async () => {
    const decided = { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 } };
    const done = view({
      computed: { skills: {}, overall: null, pooled: null, status: "READY", verification: null, course: course({ total: 52, pct: 70.3, outcome: "PASS", recommendation: "B2.1" }) } as ComputedResult,
      gradings: [
        dbGrading("gw", "rw1", { status: "CONFIRMED", courseProposal: writingProposal(), coursePoints: decided, decidedBy: "u1" }),
        dbGrading("gs", "rs1", { status: "OVERRIDDEN", courseProposal: speakingProposal(), coursePoints: { points: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 3 } }, decidedBy: "u1", reason: "ok" }),
      ],
    });
    const out = await page(done);
    expect(out).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Ergebnis abschließen/);
    expect(text(out)).toContain("Alles ist erledigt. Sie können das Ergebnis abschließen.");
    expect(text(out)).toContain("Vorläufig: Bestanden");
  });

  it("applies the teacher's PASS or FAIL over the engine's", async () => {
    const out = text(
      await page(
        view({
          computed: { skills: {}, overall: null, pooled: null, status: "READY", verification: null, course: course({ total: 52, pct: 70.3, outcome: "PASS" }) } as ComputedResult,
          skillOverrides: { COURSE_OUTCOME: { level: "FAIL", decider: "TEACHER", userId: "u1", reason: "Anwesenheit", at: "2026-10-28T10:00:00.000Z" } },
        }),
      ),
    );
    expect(out).toContain("Vorläufig: Nicht bestanden");
    expect(out).toContain("hat das Ergebnis auf Nicht bestanden gesetzt: Anwesenheit");
  });

  it("shows the release button for a final result, and no override or finalize", async () => {
    const out = await page(view({ status: "FINAL", finalOutcome: "PASS", computed: { skills: {}, overall: null, pooled: null, status: "READY", verification: null, course: course({ total: 52, pct: 70.3, outcome: "PASS" }) } as ComputedResult }));
    expect(text(out)).toContain("Für Lernende freigeben");
    expect(text(out)).not.toContain("Ergebnis abschließen");
    expect(out).not.toContain('name="outcome"');
    expect(text(out)).toContain("Bestanden");
    expect(text(out)).not.toContain("Vorläufig");
  });

  it("words a refusal that came back on the address", async () => {
    expect(text(await page(view(), { error: "changed" }))).toContain("Die Punkte weichen vom KI-Vorschlag ab");
    expect(text(await page(view(), { error: "points" }))).toContain("Die Punkte sind ungültig");
  });

  it("opens the writing tab with the AI's analysis and the grading form", async () => {
    const out = await page(view(), { tab: "WRITING" });
    expect(text(out)).toContain("Leitpunkt-Check");
    expect(out).toContain('name="points.WORTSCHATZ"');
    expect(out).toContain('name="commonErrors"');
  });

  it("opens the speaking tab with one block per task", async () => {
    const out = await page(view(), { tab: "SPEAKING" });
    expect(text(out)).toContain("Aufgabe 1 von 1");
    expect(text(out)).toContain("Sprechen: noch nicht entschieden");
    expect(out).toContain('name="points.AUSSPRACHE"');
  });

  it("speaks English", async () => {
    const out = text(html("en", await CourseResultPage({ user, locale: "en", view: view(), row, problems: [], feedback: null, sp: {}, id: "a1" })));
    expect(out).toContain("Marking sheet");
    expect(out).toContain("End-of-course test B1 · Form A");
  });
});
