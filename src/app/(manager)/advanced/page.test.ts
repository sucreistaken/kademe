import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { CreationDraftRow } from "@/server/create/drafts";
import type { AdvancedCard, Creator } from "@/solutions/types";

/** The Advanced page's tree, with the store, the registry and the actions faked. */
vi.mock("@/db", () => ({ db: {} }));
const s = vi.hoisted(() => ({
  role: "OWNER" as "OWNER" | "MANAGER" | "REVIEWER",
  row: null as unknown,
  recent: [] as unknown[],
  renderReview: vi.fn(async () => "REVIEW-CARDS" as unknown),
}));
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", email: "", name: "", role: s.role }) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/server/create/drafts", () => ({ loadOwnDraft: async () => s.row, recentDrafts: async () => s.recent }));
vi.mock("@/server/create/areas", () => ({
  advancedAreaCards: async () => [{ key: "exams", title: "Sınavlar", lines: ["2 sınav"], href: "/exam/exams" }],
}));
vi.mock("@/solutions/registry.server", async () => {
  const { can } = await import("@/lib/authorize");
  const creators = [
    { kind: "POSITION", capability: "library:write", label: { tr: "Pozisyon", en: "Position" }, renderReview: s.renderReview },
    { kind: "EXAM", capability: "blueprint:write", label: { tr: "Sınav", en: "Exam" }, renderReview: s.renderReview },
  ] as unknown as Creator[];
  return {
    creatorsFor: (user: { role: "OWNER" | "MANAGER" | "REVIEWER" }) => creators.filter((c) => can(user, c.capability)),
    creatorByKind: (kind: string) => creators.find((c) => c.kind === kind) ?? null,
  };
});
vi.mock("./actions", () => ({
  startCreate: async function startCreate() {},
  answerQuestions: async function answerQuestions() {},
  applyDraft: async function applyDraft() {},
  discardDraft: async function discardDraft() {},
  reviseDraft: async function reviseDraft() {},
  startFollowUp: async function startFollowUp() {},
}));

import { CreateBox } from "@/components/advanced/create-box";
import { QuestionRound } from "@/components/advanced/question-round";
import * as actions from "./actions";
import AdvancedPage from "./page";

const ID = "33333333-3333-4333-8333-333333333333";
const row = (over: Partial<CreationDraftRow> = {}): CreationDraftRow => ({
  id: ID,
  orgId: "o1",
  userId: "u1",
  request: "B1 sınavı",
  rounds: [],
  kind: null,
  summary: null,
  params: null,
  draft: null,
  status: "ASKING",
  failure: null,
  result: null,
  resultHref: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function find(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(match(element) ? [element] : []), ...find(element.props?.children, match)];
}
function texts(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  return texts((node as ReactElement<{ children?: ReactNode }>).props?.children);
}
const render = async (sp: Record<string, string> = {}) => (await AdvancedPage({ searchParams: Promise.resolve(sp) })) as ReactNode;
const cardsOf = (tree: ReactNode) => find(tree, (el) => !!(el.props as { card?: AdvancedCard }).card).map((el) => (el.props as { card: AdvancedCard }).card.href);

beforeEach(() => {
  s.role = "OWNER";
  s.row = null;
  s.recent = [];
  s.renderReview.mockClear();
});

describe("Advanced page", () => {
  it("shows a reviewer the area cards only, and reads no draft", async () => {
    s.role = "REVIEWER";
    s.row = row();
    const tree = await render({ draft: ID });
    expect(find(tree, (el) => el.type === CreateBox)).toHaveLength(0);
    expect(find(tree, (el) => el.type === QuestionRound)).toHaveLength(0);
    expect(cardsOf(tree)).toEqual(["/exam/exams"]);
  });

  it("gives a builder the box with what it can build and the filled button", async () => {
    const [box] = find(await render(), (el) => el.type === CreateBox);
    expect(box.props).toMatchObject({ kinds: ["Pozisyon", "Sınav"], initialText: "", primary: true, startAction: actions.startCreate });
  });

  it("shows the open question round and quiets the box's button", async () => {
    const q = { id: "mode", text: "Sınav ne için olacak?", choices: ["A", "B"] };
    s.row = row({ status: "ASKING", kind: "EXAM", summary: "B1", rounds: [{ questions: [q], answers: {} }] });
    const tree = await render({ draft: ID });
    const [round] = find(tree, (el) => el.type === QuestionRound);
    expect(round.props).toMatchObject({ draftId: ID, summary: "B1", questions: [q], answerAction: actions.answerQuestions, discardAction: actions.discardDraft });
    expect(find(tree, (el) => el.type === CreateBox)[0].props.primary).toBe(false);
  });

  it("hands a drafted draft to its creator's review with the bound actions", async () => {
    s.row = row({ status: "DRAFTED", kind: "EXAM", summary: "s", draft: { x: 1 } });
    const tree = await render({ draft: ID });
    expect(s.renderReview).toHaveBeenCalledWith({
      ctx: { orgId: "o1", userId: "u1", role: "OWNER", locale: "tr", draftId: ID },
      draft: { x: 1 },
      summary: "s",
      actions: { apply: actions.applyDraft, discard: actions.discardDraft, revise: actions.reviseDraft },
    });
    expect(texts(tree)).toContain("REVIEW-CARDS");
  });

  it("keys the open draft by its last change, so a revised draft remounts its cards", async () => {
    const at = new Date("2026-10-07T00:00:00Z");
    s.row = row({ status: "DRAFTED", kind: "EXAM", summary: "s", draft: { x: 1 }, updatedAt: at });
    const [wrap] = find(await render({ draft: ID }), (el) => el.key === `${ID}:${at.getTime()}`);
    expect(wrap).toBeDefined();
    expect(texts(wrap)).toContain("REVIEW-CARDS");
  });

  it("says what it needs, links the manual pages and keeps the request in the box", async () => {
    s.row = row({ status: "FAILED", failure: "STUCK", kind: "POSITION", rounds: [{ questions: [{ id: "name", text: "Pozisyonun adı ne?", choices: [] }], answers: {} }] });
    const tree = await render({ draft: ID });
    expect(texts(tree)).toContain("Şunu bilmem gerekiyor: Pozisyonun adı ne?");
    expect(find(tree, (el) => el.type === Link).map((el) => el.props.href)).toContain("/exam/exams");
    expect(find(tree, (el) => el.type === CreateBox)[0].props).toMatchObject({ initialText: "B1 sınavı", primary: true });
  });

  it("lists recent drafts with a way back into the open ones and to applied results", async () => {
    s.recent = [
      row({ id: "a1", status: "DRAFTED", kind: "EXAM", summary: "B1 sınavı, 40 dk" }),
      row({ id: "b2", status: "APPLIED", kind: "POSITION", summary: "Destek", resultHref: "/library/positions/p1" }),
      row({ id: "c3", status: "DISCARDED", kind: null, summary: null, request: "boş istek" }),
    ];
    const tree = await render();
    const hrefs = find(tree, (el) => el.type === Link).map((el) => el.props.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/advanced?draft=a1", "/library/positions/p1"]));
    expect(hrefs.filter((h) => String(h).includes("c3"))).toEqual([]);
    expect(texts(tree)).toEqual(expect.arrayContaining(["Sınav", "B1 sınavı, 40 dk", "Onay bekliyor", "Pozisyon", "Kaydedildi", "Belirsiz", "boş istek", "Vazgeçildi"]));
  });
});
