import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/app/(manager)/hiring/openings/[id]/candidates/actions", () => ({
  markRequestAction: async () => undefined,
  extendHiringLinkAction: async () => undefined,
  newLinkAction: async () => ({ ok: false, code: "NOT_FOUND" }),
}));

import { extendHiringLinkAction, markRequestAction } from "@/app/(manager)/hiring/openings/[id]/candidates/actions";
import { StatusDot } from "@/components/ui/status-dot";
import { managerT } from "@/i18n/manager";
import type { OpeningCandidateRow } from "@/solutions/hiring/server/invitations";
import { CandidateTable } from "./candidate-table";
import { NewLinkButton } from "./new-link-button";

type El = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

function all(node: ReactNode): El[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(all);
  const element = node as El;
  return [element, ...all(element.props?.children)];
}

function text(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  const element = node as El;
  const own = ["label", "pendingLabel"].map((key) => (typeof element.props?.[key] === "string" ? (element.props[key] as string) : "")).join(" ");
  return `${own} ${text(element.props?.children)}`;
}

const NOW = new Date("2026-10-05T09:00:00Z");
const OPENING = "22222222-2222-4222-8222-222222222222";

const base: OpeningCandidateRow = {
  assessmentId: "a1",
  candidateId: "c1",
  seq: 1,
  name: "Elif Kaya",
  email: "elif@example.com",
  locale: "tr",
  invitedAt: NOW,
  link: { id: "l1", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T20:59:59Z") },
  progress: "INVITED",
  stagesDone: 0,
  stageCount: 2,
  lastActivityAt: null,
  completedAt: null,
  adapted: true,
  requests: [
    { id: "r1", source: "REQUEST", kind: "NEW_LINK", message: "Linkim açılmıyor", createdAt: NOW },
    { id: "d1", source: "DATA_RIGHTS", kind: "DELETE", message: null, createdAt: NOW },
  ],
};

function render(rows: OpeningCandidateRow[], edit: boolean, closed = { closed: false, runs: edit }) {
  return CandidateTable({ rows, openingId: OPENING, edit, ...closed, locale: "tr", t: managerT("tr"), now: NOW });
}

describe("CandidateTable (HIRING-UX 5.12)", () => {
  it("offers 'Tamam' only on the candidate's own requests, never on a data rights row (Task 6 carry)", () => {
    const tree = all(render([base], true));
    const done = tree.filter((e) => e.type === "form" && e.props.action === markRequestAction);
    expect(done).toHaveLength(1);
    const ids = all(done[0].props.children).filter((e) => e.type === "input" && e.props.name === "requestId").map((e) => e.props.value);
    expect(ids).toEqual(["r1"]);
    const words = text(render([base], true));
    expect(words).toContain("Yeni link talebi");
    expect(words).toContain("Veri silme talebi");
    expect(words).toContain("Linkim açılmıyor");
  });

  it("gives someone who runs the opening a new link (warning visible) and the opening's own extend for a link not yet used", () => {
    const tree = all(render([base], true));
    expect(tree.filter((e) => e.type === NewLinkButton).map((e) => e.props.assessmentId)).toEqual(["a1"]);
    const extend = tree.filter((e) => e.type === "form" && e.props.action === extendHiringLinkAction);
    expect(extend).toHaveLength(1);
    const fields = Object.fromEntries(all(extend[0].props.children).filter((e) => e.type === "input").map((e) => [e.props.name, e.props.value]));
    expect(fields).toEqual({ openingId: OPENING, assessmentId: "a1" });
  });

  it("offers no extend once the candidate has started, and nothing on a finished row", () => {
    const started = all(render([{ ...base, progress: "IN_PROGRESS", link: { ...base.link!, status: "IN_PROGRESS" } }], true));
    expect(started.filter((e) => e.type === "form" && e.props.action === extendHiringLinkAction)).toHaveLength(0);
    expect(started.filter((e) => e.type === NewLinkButton)).toHaveLength(1);
    const done = render([{ ...base, progress: "COMPLETED", link: { ...base.link!, status: "COMPLETED" }, requests: [] }], true);
    expect(all(done).filter((e) => e.type === NewLinkButton || e.type === "form")).toHaveLength(0);
    expect(text(done)).toContain("Kullanıldı");
  });

  it("gives a reader no buttons, and shows 'Aday 1' when the name was not read", () => {
    const masked = { ...base, name: null, email: null, adapted: false, requests: [] };
    const tree = render([masked], false);
    expect(all(tree).filter((e) => e.type === NewLinkButton || e.type === "form")).toHaveLength(0);
    expect(text(tree)).toContain("Aday 1");
    expect(text(tree)).not.toContain("Süre uyarlaması");
  });

  it("says an adaptation was applied without a number (A6)", () => {
    const words = text(render([base], true));
    expect(words).toContain("Süre uyarlaması uygulandı");
    expect(words).not.toMatch(/%|\d+ ?yüzde/);
  });

  it("tells the new link's button when the candidate is inside a stage (Minor 1)", () => {
    const started = all(render([{ ...base, progress: "IN_PROGRESS", link: { ...base.link!, status: "IN_PROGRESS" } }], true));
    expect(started.filter((e) => e.type === NewLinkButton).map((e) => e.props.started)).toEqual([true]);
    expect(all(render([base], true)).filter((e) => e.type === NewLinkButton).map((e) => e.props.started)).toEqual([false]);
  });

  it("on a closed opening offers a new link only to a candidate who started, and says why (Task 7 ruling)", () => {
    const rows: OpeningCandidateRow[] = [
      { ...base, assessmentId: "a-started", progress: "IN_PROGRESS", link: { ...base.link!, status: "IN_PROGRESS" }, requests: [] },
      { ...base, assessmentId: "a-waiting", seq: 2, requests: [] },
    ];
    const tree = render(rows, false, { closed: true, runs: true });
    const nodes = all(tree);
    expect(nodes.filter((e) => e.type === NewLinkButton).map((e) => [e.props.assessmentId, e.props.started])).toEqual([["a-started", true]]);
    expect(nodes.filter((e) => e.type === "form")).toHaveLength(0);
    const words = text(tree);
    expect(words).toContain("Alım kapalı; başlamış aday bitirebilsin diye yeni link üretilebilir.");
    expect(words).toContain("Alım kapalı; başlamamış adaya yeni link üretilmez.");
    // A reader of a closed opening still gets nothing to press.
    expect(all(render(rows, false, { closed: true, runs: false })).filter((e) => e.type === NewLinkButton)).toHaveLength(0);
  });

  it("on a closed opening still offers 'Tamam' on a request to someone who runs it, never to a reader (U2)", () => {
    const rows: OpeningCandidateRow[] = [{ ...base, progress: "IN_PROGRESS", link: { ...base.link!, status: "IN_PROGRESS" } }];
    const tree = all(render(rows, false, { closed: true, runs: true }));
    const done = tree.filter((e) => e.type === "form" && e.props.action === markRequestAction);
    expect(done).toHaveLength(1);
    expect(all(done[0].props.children).filter((e) => e.type === "input" && e.props.name === "requestId").map((e) => e.props.value)).toEqual(["r1"]);
    // Still no extend on a closed opening, and a data-rights row keeps its note only.
    expect(tree.filter((e) => e.type === "form" && e.props.action === extendHiringLinkAction)).toHaveLength(0);
    expect(text(render(rows, false, { closed: true, runs: true }))).toContain("Veri silme talebi");
    // A reader of the closed opening gets nothing to press (their rows carry no requests anyway).
    expect(all(render(rows, false, { closed: true, runs: false })).filter((e) => e.type === "form")).toHaveLength(0);
  });

  it("draws each status from the one dictionary (P9): an expired link in bold ink, a live one with the accent dot", () => {
    const dots = (progress: OpeningCandidateRow["progress"]) =>
      all(render([{ ...base, progress, requests: [] }], true))
        .filter((e) => e.type === StatusDot)
        .map((e) => [e.props.tone, e.props.className ?? null]);
    expect(dots("EXPIRED")).toEqual([["warn", "font-semibold text-ink"]]);
    expect(dots("IN_PROGRESS")).toEqual([["active", null]]);
    expect(dots("COMPLETED")).toEqual([["done", null]]);
  });
});
