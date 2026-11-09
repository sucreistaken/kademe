import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";

// canonicalJson is pure, but its module also holds the database writes: no database here.
vi.mock("@/db", () => ({ db: {} }));
import { candidateT } from "@/i18n/candidate";
import { PRESETS } from "@/lib/proctor/policy";
import { canonicalJson } from "@/server/template-blueprint";
import { bankCoverage, blueprintConfigSchema, enabledSections, estimatedMinutes, type BankCount } from "./blueprint";
import { candidateExamName } from "./candidate-exam-name";
import { COURSE_EXAM_TEMPLATES } from "./course/templates";
import { EXAM_TEMPLATES, examTemplateByKey, readyTemplateByKey, WEB_CHECK_KEY, webCheckTemplate } from "./templates";
import { C_TEST_SKILL_TAG, CEFR_LEVELS, CLOZE_SKILL_TAG, OPEN_CLOZE_SKILL_TAG, SECTIONS, WORD_BANK_SKILL_TAG } from "./types";

/** The seed bank as `bankCounts` would see it once imported (as templates.test.ts counts it). */
function seedCounts(): BankCount[] {
  return SECTIONS.flatMap((section) =>
    CEFR_LEVELS.map((level) => {
      const items = SEED_BANK.items.filter((i) => i.section === section && i.level === level);
      return {
        section,
        level,
        items: items.length,
        stimuli: new Set(items.map((i) => i.stimulusKey).filter(Boolean)).size,
        cTests: items.filter((i) => i.skillTag === C_TEST_SKILL_TAG).length,
        clozeTexts: items.filter((i) => i.skillTag === CLOZE_SKILL_TAG).length,
        wordBanks: items.filter((i) => i.skillTag === WORD_BANK_SKILL_TAG).length,
        openTexts: items.filter((i) => i.skillTag === OPEN_CLOZE_SKILL_TAG).length,
      };
    }),
  );
}

const quickScreen = () => examTemplateByKey("quick-screen")!;

describe("the web-check template (public level test, 2026-11-09)", () => {
  it("is the quick screen, unwatched and on phones: nothing else differs", () => {
    const web = webCheckTemplate();
    const quick = quickScreen();
    expect(web.key).toBe(WEB_CHECK_KEY);
    expect(web.mode).toBe(quick.mode);
    expect(web.config.proctoring).toEqual(PRESETS.OFF);
    expect(web.config.allowMobile).toBe(true);
    // The same config once the two intended differences are put back to the quick screen's.
    expect(canonicalJson({ ...web.config, proctoring: quick.config.proctoring, allowMobile: undefined })).toBe(canonicalJson(quick.config));
  });

  it("is grammar only, 25 minutes, and releases the level by itself", () => {
    const web = webCheckTemplate();
    expect(enabledSections(web.config).map((s) => s.section)).toEqual(["GRAMMAR"]);
    expect(estimatedMinutes(web.config)).toBe(25);
    expect(web.config.autoRelease).toBe(true);
    expect(web.config.resultVisibility).toBe("OVERALL");
  });

  it("validates with the blueprint schema, which keeps the phone flag", () => {
    const parsed = blueprintConfigSchema.safeParse(webCheckTemplate().config);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.allowMobile).toBe(true);
  });

  it("is covered by the current seed bank", () => {
    const web = webCheckTemplate();
    const coverage = bankCoverage(seedCounts(), web.config, web.mode, null);
    expect(coverage.rows.filter((r) => !r.ok)).toEqual([]);
    expect(coverage.ok).toBe(true);
  });

  it("stays out of the wizard, the AI creator and the invite form", () => {
    expect(EXAM_TEMPLATES.map((t) => t.key)).toEqual(["quick-screen", "placement", "level-check"]);
    expect(examTemplateByKey(WEB_CHECK_KEY)).toBeNull();
    expect(readyTemplateByKey(WEB_CHECK_KEY)).toBeNull();
  });

  it("hands out copies, so a caller that edits one never changes the next", () => {
    const first = webCheckTemplate();
    first.config.sections[0].durationMinutes = 1;
    first.config.proctoring.camera = true;
    expect(webCheckTemplate().config.sections[0].durationMinutes).toBe(25);
    expect(webCheckTemplate().config.proctoring.camera).toBe(false);
    expect(quickScreen().config.proctoring).toEqual(PRESETS.STANDARD);
  });

  it("reads its default name in the student's language, as the ready templates do", () => {
    const web = webCheckTemplate();
    expect(candidateT("tr")("examNames.webCheck")).toBe(web.name.tr);
    expect(candidateT("en")("examNames.webCheck")).toBe(web.name.en);
    for (const from of ["tr", "en"] as const) {
      for (const to of ["tr", "en", "de", "es", "ar"] as const) {
        expect(candidateExamName(web.name[from], to)).toBe(candidateT(to)("examNames.webCheck"));
      }
    }
    for (const to of ["de", "es", "ar"] as const) expect(candidateT(to)("examNames.webCheck")).not.toBe(web.name.en);
  });
});

/**
 * The ready templates and the eight course tests as they were before the web
 * check (main 9725381, sha256 of canonicalJson({ mode, config })): adding it
 * changed none of them, so no published exam is retired by it. A deliberate
 * change to a template updates its line here.
 */
const BEFORE_WEB_CHECK: Record<string, string> = {
  "quick-screen": "d775d8eb2db58eb6a3c6d1f60ee65dde7ebfbcc984355cfa7d227e10efa7db31",
  placement: "8471d999a42f4c774b782a318382a900ecdfb6e29fb9a77d3f15f813b5b1b87f",
  "level-check": "c6d8334541808c5c96c1b9841020436a4267e50c742419b5db97ad897ee8a2f3",
  "course-a1-1": "794bc5ad63ecacc65e5ce311fad7dd33d4044fd165acb81cb31ce897ff560dfe",
  "course-a1": "bf11249899aee944c376a3f91ffe02756f1f778d0624946946141242a3a1c991",
  "course-a2-1": "1ad1d7bf1cc56ed2fce715d79d5990a9945dd4f77fee62ef39c839d7dfb97310",
  "course-a2": "0408b90dab1676954ca5f53fe15086e67ea7d4c7f3880be10cb76932196b15d2",
  "course-b1-1": "ad60b1328555279263374d15339f4d506f82c1b0e18271249ce53cb7fcaed17e",
  "course-b1": "d5d3e6aa0400813ec7066a75773ad9808684ef9d24837c22f86762a723696b88",
  "course-b2-1": "42ea25c6aa8a4b1727f6107d0aaf6b250efa49466ed2697dda6a9159560ec105",
  "course-b2": "475be5a155f98f74b765f3a7f79b463378fe3f0a58b973238ab42afcb465f257",
};

describe("existing templates are unchanged by the web check", () => {
  it("every ready template and course test has the config it had before", () => {
    const now = Object.fromEntries(
      [...EXAM_TEMPLATES, ...COURSE_EXAM_TEMPLATES].map((t) => [t.key, createHash("sha256").update(canonicalJson({ mode: t.mode, config: t.config })).digest("hex")]),
    );
    expect(now).toEqual(BEFORE_WEB_CHECK);
  });
});
