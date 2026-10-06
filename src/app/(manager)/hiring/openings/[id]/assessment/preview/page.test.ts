import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { activity, content, facts, stage } from "@/solutions/hiring/rules/test-fixtures";
import type { VersionContent } from "@/solutions/hiring/rules/content";
import type { VersionSummary } from "@/solutions/hiring/rules/versions";

/**
 * The leak guarantee of the candidate preview (HIRING-UX 5.8, Task 19 carry 3):
 * the page hands its client component (the only part whose props travel to
 * the browser in the RSC payload) the candidate view and nothing else. Every
 * team-only field below carries a sentinel; none of them, no competency id or
 * anchor and no right answer may appear in the client props.
 */
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

const OPENING = "33333333-3333-4333-8333-333333333333";
const SECRET = "SENTINEL";
const COMP = "77777777-7777-4777-8777-777777777777";

let access = { view: true, edit: true };
vi.mock("../../access", () => ({
  openingFor: async (id: string) => ({
    user: { id: "u1", orgId: "o1", email: "", name: "", role: "OWNER" },
    opening: { id, name: `${SECRET} internal opening name`, positionName: "Ürün Tasarımcısı", status: "DRAFT", memberIds: [] },
    access,
  }),
}));
vi.mock("../../opening-header", () => ({ OpeningHeader: () => null, AssessmentTabs: () => null }));
// The setup line reads the people; this test's database throws on any read, and the line is not what it tests.
vi.mock("../../setup-strip", () => ({ setupStrip: async () => null }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/server/settings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/settings")>()), loadOrg: async () => ({ id: "o1", name: "Örnek A.Ş." }) }));
vi.mock("@/components/hiring/preview/preview", () => ({ Preview: function Preview() {} }));

type State = { list: VersionSummary[]; draft: VersionSummary | null; live: VersionSummary | null; content: VersionContent | null; facts: Map<string, unknown>; problems: unknown[] };
let state: State;
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: async () => state }));

import PreviewPage from "./page";
import { Preview } from "@/components/hiring/preview/preview";

const secretDraft = content(
  [
    stage(
      "s1",
      [
        activity("a1", {
          competencyIds: [COMP],
          internalQuestion: `${SECRET} purpose`,
          expectedBehaviours: [`${SECRET} behaviour`],
          redFlags: [`${SECRET} red flag`],
          managerNotes: `${SECRET} evaluator note`,
          answerExamples: { 1: `${SECRET} one`, 3: `${SECRET} three`, 5: `${SECRET} five` },
          config: { textAlternativeEnabled: true },
        }),
        activity("a2", {
          type: "SINGLE_CHOICE",
          config: {
            choices: [
              { id: "x", label: { tr: "Evet", en: "Yes" }, correct: true },
              { id: "y", label: { tr: "Hayır", en: "No" } },
            ],
          },
        }),
        activity("a3", { type: "FILE_UPLOAD", config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 10 * 1024 * 1024 } }),
      ],
      { internalPurpose: `${SECRET} stage purpose` },
    ),
  ],
  { id: "44444444-4444-4444-8444-444444444444", number: 2, weightsEnabled: true, draftWeights: { [COMP]: 100 }, localeSet: ["tr", "en"] },
);

const summary = (number: number, status: "DRAFT" | "PUBLISHED"): VersionSummary =>
  ({ id: status === "DRAFT" ? secretDraft.id : "44444444-4444-4444-8444-444444444445", number, status, publishedAt: null, previewedAt: null }) as VersionSummary;

function find(node: ReactNode, type: unknown): ReactElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(element.type === type ? [element] : []), ...find(element.props?.children, type)];
}

async function previewProps() {
  const page = (await PreviewPage({ params: Promise.resolve({ id: OPENING }) })) as ReactElement;
  const found = find(page, Preview);
  expect(found).toHaveLength(1);
  return found[0].props as Record<string, unknown>;
}

beforeEach(() => {
  access = { view: true, edit: true };
  state = {
    list: [summary(2, "DRAFT"), summary(1, "PUBLISHED")],
    draft: summary(2, "DRAFT"),
    live: summary(1, "PUBLISHED"),
    content: secretDraft,
    facts: new Map([[COMP, facts(COMP, { name: { tr: `${SECRET} competency`, en: "" }, anchors: { 1: { tr: `${SECRET} anchor`, en: "" } } })]]),
    problems: [],
  };
});

describe("candidate preview page: what reaches the browser", () => {
  it("passes no team-only field, competency, anchor, weight or right answer to the client component", async () => {
    const text = JSON.stringify(await previewProps());
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(COMP);
    expect(text).not.toContain("correct");
    expect(text).not.toMatch(/weight|anchor|competenc|internal|redFlag|expectedBehaviour|answerExample|managerNote/i);
  });

  it("passes exactly the candidate view (a whitelist of props), the version it shows and its languages", async () => {
    const props = await previewProps();
    expect(Object.keys(props).sort()).toEqual(["companyName", "defaultLocale", "locales", "mode", "number", "openingId", "positionName", "stampVersionId", "version"]);
    expect(props).toMatchObject({ mode: "draft", number: 2, locales: ["tr", "en"], positionName: "Ürün Tasarımcısı", companyName: "Örnek A.Ş." });
    const version = props.version as { stages: Array<{ activities: Array<{ choices: unknown }> }> };
    expect(version.stages[0].activities[1].choices).toEqual([
      { id: "x", label: { tr: "Evet", en: "Yes" } },
      { id: "y", label: { tr: "Hayır", en: "No" } },
    ]);
  });

  it("stamps only a draft and only for an editor: a live version or a reviewer's visit gets no version to stamp", async () => {
    expect((await previewProps()).stampVersionId).toBe(secretDraft.id);
    access = { view: true, edit: false };
    expect((await previewProps()).stampVersionId).toBeNull();
    access = { view: true, edit: true };
    state = { ...state, draft: null, list: [summary(1, "PUBLISHED")], content: { ...secretDraft, id: "44444444-4444-4444-8444-444444444445", number: 1, status: "PUBLISHED" } };
    const live = await previewProps();
    expect(live).toMatchObject({ mode: "live", number: 1, stampVersionId: null });
  });

  it("an empty draft is shown (with its empty state) but not stamped: nothing was previewed", async () => {
    state = { ...state, content: { ...secretDraft, stages: [] } };
    expect((await previewProps()).stampVersionId).toBeNull();
  });
});
