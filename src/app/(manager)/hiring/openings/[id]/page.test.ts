import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { fake, type Op } from "@/solutions/hiring/server/test-fake-db";

/**
 * The opening overview (HIRING-UX 5.4, Task 19): the invite Sheet where it can
 * open and the waiting button with its reason where it cannot (the Candidates
 * tab's reasons), and the funnel with the candidate experience. The funnel is
 * read through the real openingFunnel on a fake database, so these tests also
 * prove what reaches the page: no survey date and no per-comment rating
 * (Task 16 carry, Task 19 ruling 1).
 */
vi.mock("@/db", async () => ({ db: (await import("@/solutions/hiring/server/test-fake-db")).fakeDb() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const OPENING = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const OWNER = "55555555-5555-4555-8555-555555555555";
const REVIEWER = "77777777-7777-4777-8777-777777777777";
const NOW = new Date("2026-10-05T09:00:00Z");
// A date and a rating no part of the page may carry (Task 19 ruling 1).
const SENTINEL_AT = new Date("2001-02-03T04:05:06.789Z");

type Role = "OWNER" | "MANAGER" | "REVIEWER";
let viewer: { role: Role; edit: boolean };
let status: "DRAFT" | "OPEN" | "CLOSED";
let surveyOn: boolean;
let state: { draft: unknown; live: unknown };
let invited: number;
let answers: Array<{ rating: number; comment: string | null }>;

const openingFor = vi.fn(async (id: string) => ({
  user: { id: viewer.role === "REVIEWER" ? REVIEWER : OWNER, orgId: ORG, email: "", name: "", role: viewer.role },
  opening: {
    id,
    name: "Tasarımcı · Ekim",
    positionName: "Tasarımcı",
    status,
    memberIds: [REVIEWER],
    decisionMakerId: OWNER,
    backupDecisionMakerId: null,
    minEvaluations: 1,
    blindMode: false,
    deadlineAt: null,
    feedbackDays: 7,
    candidateContactEmail: null,
    finishSurveyEnabled: surveyOn,
    updatedAt: NOW,
  },
  access: { view: true, edit: viewer.edit },
}));
vi.mock("./access", () => ({ openingFor: (id: string) => openingFor(id) }));
vi.mock("./opening-header", () => ({ OpeningHeader: function OpeningHeader() {} }));
vi.mock("./actions", () => ({ publishOpeningAction: async function publishOpeningAction() {} }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
vi.mock("@/components/ui/url-notice", () => ({ UrlNotice: function UrlNotice() {} }));
vi.mock("@/components/hiring/invite/invite-sheet", () => ({ InviteSheet: function InviteSheet() {} }));
vi.mock("@/solutions/hiring/server/working", () => ({
  workingState: async () => ({ list: [], draft: state.draft, live: state.live, content: null, facts: [], problems: [] }),
}));
vi.mock("@/server/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/settings")>()),
  loadPanelUsers: async () => [{ id: OWNER, name: "Sahip", email: "o@x.test", role: "OWNER", lastLoginAt: null, disabledAt: null }],
}));

import OverviewPage from "./page";
import { Button } from "@/components/ui/button";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { OpeningHeader } from "./opening-header";

const LIVE = { id: VERSION, number: 1, status: "PUBLISHED", publishedAt: NOW, previewedAt: NOW, updatedAt: NOW };

function respond(op: Op): unknown[] {
  if (op.kind !== "select") return [];
  switch (op.table) {
    case "hiring_assessments":
      return Array.from({ length: invited }, (_, i) => ({ assessmentId: `a${i}` }));
    case "attempts":
      return invited ? [{ assessmentId: "a0", startedAt: NOW, completedAt: new Date(NOW.getTime() + 20 * 60_000) }] : [];
    case "hiring_survey_responses":
      // A database answering more than was asked for: the date must still not reach the page.
      return answers.map((a) => ({ ...a, at: SENTINEL_AT, createdAt: SENTINEL_AT }));
    case "hiring_versions":
      return [{ ...LIVE, openingId: OPENING }];
    case "hiring_stages":
      return [{ total: 1500 }];
    case "hiring_openings":
      return status === "OPEN" ? [{ id: OPENING, name: "Tasarımcı · Ekim", deadlineAt: null, minEvaluations: 1 }] : [];
    case "hiring_opening_members":
      return [{ openingId: OPENING, count: 1 }];
    default:
      return [];
  }
}

function find(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(match(element) ? [element] : []), ...find(element.props?.children, match)];
}
const ofType = (type: unknown) => (el: ReactElement) => el.type === type;
const text = (node: ReactNode): string =>
  !node || typeof node === "boolean"
    ? ""
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join("")
        : text((node as ReactElement<{ children?: ReactNode }>).props?.children);
/** Every prop of every element, as the page hands it on (a stand-in for the RSC payload). */
const dump = (node: ReactNode) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(node, (k, v: unknown) => {
    if (k.startsWith("_") || typeof v === "function" || typeof v === "symbol") return undefined;
    if (v && typeof v === "object") {
      // A dictionary handed on twice (or pointing at itself) is written once; nothing is skipped the first time.
      if (seen.has(v)) return "[seen]";
      seen.add(v);
    }
    return v;
  });
};

async function render() {
  return (await OverviewPage({ params: Promise.resolve({ id: OPENING }), searchParams: Promise.resolve({}) })) as ReactElement;
}
const header = (page: ReactElement) => find(page, ofType(OpeningHeader))[0];

beforeEach(() => {
  viewer = { role: "OWNER", edit: true };
  status = "OPEN";
  surveyOn = true;
  state = { draft: null, live: LIVE };
  invited = 3;
  answers = [];
  fake.ops = [];
  fake.respond = respond;
});

describe("the overview's invite button (Task 19 ruling 2)", () => {
  it("opens the invite Sheet on a live opening the viewer runs", async () => {
    const action = header(await render()).props.action as ReactElement;
    const sheets = find(action, ofType(InviteSheet));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].props.opening).toMatchObject({ id: OPENING, live: true, evaluators: 1 });
  });

  it("waits with the Candidates tab's reason for a reviewer, and asks nothing about invitable openings", async () => {
    viewer = { role: "REVIEWER", edit: false };
    const action = header(await render()).props.action as ReactElement;
    expect(find(action, ofType(InviteSheet))).toHaveLength(0);
    const [button] = find(action, ofType(Button));
    expect(button.props).toMatchObject({ disabled: true, disabledReason: "Rolün aday davet edemez." });
    expect(text(action)).toContain("Rolün aday davet edemez.");
    expect(fake.ops.some((o) => o.table === "hiring_openings")).toBe(false);
  });

  it("waits with the closed reason on a closed opening", async () => {
    status = "CLOSED";
    viewer = { role: "OWNER", edit: false };
    const action = header(await render()).props.action as ReactElement;
    expect(find(action, ofType(InviteSheet))).toHaveLength(0);
    expect(find(action, ofType(Button))[0].props).toMatchObject({ disabled: true, disabledReason: "Bu alım kapalı. Yeni davet yapılamaz." });
    expect(text(action)).toContain("Bu alım kapalı. Yeni davet yapılamaz.");
  });
});

describe("the overview's funnel (HIRING-UX 5.4)", () => {
  it("counts the invitations and shows the median time against the estimate", async () => {
    const body = text(await render());
    expect(body).toContain("Davet");
    expect(body).toContain("Başladı");
    expect(body).toContain("Tamamladı");
    expect(body).toContain("Ortanca süre 20 dk · tahmin 25 dk");
    expect(body).toContain("Tüm adaylar");
  });

  it("says so before the first invitation", async () => {
    invited = 0;
    const body = text(await render());
    expect(body).toContain("Henüz aday yok. İlk daveti açınca huni burada görünür.");
    expect(body).not.toContain("Aday deneyimi");
  });

  it("from five answers shows the average and unnamed comments, never a date or a rating per comment", async () => {
    answers = [
      { rating: 5, comment: "Akıcıydı" },
      { rating: 4, comment: null },
      { rating: 3, comment: "Uzundu" },
      { rating: 4, comment: "Net" },
      { rating: 5, comment: " " },
      { rating: 4, comment: "Kısa" },
    ];
    const page = await render();
    const body = text(page);
    expect(body).toContain("4,2/5 · 6 cevap");
    expect(["Akıcıydı", "Uzundu", "Net", "Kısa"].filter((c) => body.includes(c))).toHaveLength(3);
    // Only the average carries "/5": no comment has its own rating beside it.
    expect(body.match(/\/5/g)).toHaveLength(1);
    const all = dump(page);
    // Positive controls: the dump carries the shown comments and the dates the page does hand on.
    expect(["Akıcıydı", "Uzundu", "Net", "Kısa"].filter((c) => all.includes(c))).toHaveLength(3);
    expect(all).toContain(NOW.toISOString());
    expect(all).not.toContain("2001-02-03");
    expect(all).not.toContain(String(SENTINEL_AT.getTime()));
    expect(all).not.toContain('"rating"');
  });

  it("below five answers shows no comment, only how many are still needed", async () => {
    answers = [
      { rating: 1, comment: "Kötüydü" },
      { rating: 2, comment: "Uzundu" },
      { rating: 5, comment: "İyi" },
      { rating: 4, comment: "Net" },
    ];
    const page = await render();
    const body = text(page);
    expect(body).toContain("5 cevap gelince görünür; şu an 4.");
    for (const c of ["Kötüydü", "Uzundu", "İyi", "Net"]) expect(dump(page)).not.toContain(c);
  });

  it("says the survey is off when it is switched off and too few answers came", async () => {
    surveyOn = false;
    expect(text(await render())).toContain("Bitiş anketi kapalı.");
  });

  it("stays visible while a new draft waits on top of the live version (5.4: the funnel while published)", async () => {
    state = { draft: { ...LIVE, id: "d", number: 2, status: "DRAFT", publishedAt: null }, live: LIVE };
    const body = text(await render());
    expect(body).toContain("Yayına hazırlık");
    expect(body).toContain("Tamamladı");
    invited = 0;
    const empty = text(await render());
    expect(empty).toContain("Yayına hazırlık");
    expect(empty).not.toContain("Henüz aday yok");
  });
});
