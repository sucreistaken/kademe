import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { fake, type Op } from "@/solutions/hiring/server/test-fake-db";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import type { VersionContent } from "@/solutions/hiring/rules/content";

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
let state: { draft: unknown; live: unknown; content?: VersionContent | null; problems?: unknown[] };
let sp: Record<string, string>;
/** Rows the opening's attention card counts (openingCardFacts): open requests and links about to expire, by invitation. */
let requestRows: number;
let expiringRows: number;
let invited: number;
/** Survey answers, oldest first. */
let answers: Array<{ rating: number; comment: string | null }>;
let stageSeconds: number;
/** The invite form's view of the opening (invitableOpenings): its active evaluators and its last day. */
let teamCount: number;
let openingDeadlineAt: Date | null;
let minEvaluations: number;
type Person = { id: string; name: string; email: string; role: Role; lastLoginAt: null; disabledAt: Date | null };
/** The organisation's users (loadPanelUsers): the owner deciding and the reviewer on the team, both active. */
let people: Person[];
const person = (id: string, name: string, role: Role, disabledAt: Date | null = null): Person => ({ id, name, email: `${name}@x.test`, role, lastLoginAt: null, disabledAt });

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
/** When each read began and ended (B-M5: one after another, ruling C21). */
const order: string[] = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
vi.mock("@/solutions/hiring/server/working", () => ({
  workingState: async () => {
    order.push("working:start");
    await tick();
    order.push("working:end");
    return { list: [], draft: state.draft, live: state.live, content: state.content ?? null, facts: new Map(), problems: state.problems ?? [] };
  },
}));
vi.mock("@/server/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/settings")>()),
  loadPanelUsers: async () => {
    order.push("people:start");
    await tick();
    order.push("people:end");
    return people;
  },
}));

import OverviewPage from "./page";
import { Button } from "@/components/ui/button";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { OpeningHeader } from "./opening-header";
import { PUBLISHED_NOTICE_ID, PublishFooter, PublishLink, PublishSwitch, SETUP_HEADING_ID } from "./publish-view";
import { Illustration } from "@/components/visual/illustrations";
import { managerT } from "@/i18n/manager";
import Link from "next/link";
import { HashAwareLink } from "@/components/manager/hash-aware-link";
import { PathSteps } from "@/components/visual/path-steps";
import { StepScreen } from "@/components/visual/step-screen";

const LIVE = { id: VERSION, number: 1, status: "PUBLISHED", publishedAt: NOW, previewedAt: NOW, updatedAt: NOW };

function respond(op: Op): unknown[] {
  if (op.kind !== "select") return [];
  switch (op.table) {
    case "hiring_assessments":
      return Array.from({ length: invited }, (_, i) => ({ assessmentId: `a${i}`, openingId: OPENING, candidateId: `c${i}` }));
    case "candidate_requests":
      return Array.from({ length: requestRows }, () => ({ assessmentId: "a0" }));
    case "assessment_links":
      return Array.from({ length: expiringRows }, () => ({ assessmentId: "a1" }));
    case "attempts":
      return invited ? [{ assessmentId: "a0", startedAt: NOW, completedAt: new Date(NOW.getTime() + 20 * 60_000) }] : [];
    case "hiring_survey_responses":
      return [{ n: answers.length }];
    case "(execute)": {
      // The released answers as Postgres answers the funnel's statement (LIMIT = the released count).
      const limit = op.params.find((p) => typeof p === "number") as number;
      const released = answers.slice(0, limit);
      const comments = released
        .filter((a) => a.comment?.trim())
        .reverse()
        .slice(0, 20)
        .map((a) => a.comment);
      // A database answering more than was asked for: the date must still not reach the page.
      return [{ count: released.length, average: String(released.reduce((sum, a) => sum + a.rating, 0) / released.length), comments, createdAt: SENTINEL_AT, at: SENTINEL_AT }];
    }
    case "hiring_versions":
      return [{ ...LIVE, openingId: OPENING }];
    case "hiring_stages":
      return [{ id: "s1", durationSeconds: stageSeconds, graceSeconds: 0, onTimeout: "AUTO_SUBMIT" }];
    case "hiring_openings":
      return status === "OPEN" ? [{ id: OPENING, name: "Tasarımcı · Ekim", deadlineAt: openingDeadlineAt, minEvaluations }] : [];
    case "hiring_opening_members":
      return [{ openingId: OPENING, count: teamCount }];
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
  return (await OverviewPage({ params: Promise.resolve({ id: OPENING }), searchParams: Promise.resolve(sp) })) as ReactElement;
}
const header = (page: ReactElement) => find(page, ofType(OpeningHeader))[0];

beforeEach(() => {
  viewer = { role: "OWNER", edit: true };
  status = "OPEN";
  surveyOn = true;
  state = { draft: null, live: LIVE };
  invited = 3;
  answers = [];
  stageSeconds = 1500;
  teamCount = 1;
  openingDeadlineAt = null;
  minEvaluations = 1;
  sp = {};
  people = [person(OWNER, "Sahip", "OWNER"), person(REVIEWER, "Ece", "REVIEWER")];
  requestRows = 0;
  expiringRows = 0;
  fake.ops = [];
  fake.respond = (op) => {
    order.push(`db:${op.table}`);
    return respond(op);
  };
  order.length = 0;
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

  it("draws no 'Aday davet et' on a closed opening, only the closed note and 'Yeniden aç' (4.5, B-M9)", async () => {
    status = "CLOSED";
    viewer = { role: "OWNER", edit: false };
    const page = await render();
    expect(header(page).props.action).toBeNull();
    expect(find(page, ofType(Button))).toHaveLength(0);
    const body = text(page);
    expect(body).toContain("Bu alım kapalı; değerlendirme ve kayıtlar okunur kalır.");
    expect(body).toContain("Ekip ve kurallarda yeniden aç");
  });

  it("waits with the form's own reason while no active evaluator is on the team (B-M3)", async () => {
    teamCount = 0;
    const action = header(await render()).props.action as ReactElement;
    expect(find(action, ofType(InviteSheet))).toHaveLength(0);
    expect(find(action, ofType(Button))[0].props).toMatchObject({ disabled: true, disabledReason: "Önce ekibe en az bir değerlendirici ekle." });
    expect(text(action)).toContain("Önce ekibe en az bir değerlendirici ekle.");
  });

  it("waits with the form's own reason once the opening's last day passed (B-M3)", async () => {
    openingDeadlineAt = new Date("2020-01-10T20:59:59Z");
    const action = header(await render()).props.action as ReactElement;
    expect(find(action, ofType(InviteSheet))).toHaveLength(0);
    expect(find(action, ofType(Button))[0].props).toMatchObject({ disabled: true, disabledReason: "Bu alımın son günü geçti. Ekip ve kurallardan yeni bir son tarih seç." });
  });
});

describe("the overview's funnel (HIRING-UX 5.4)", () => {
  it("counts the invitations and shows the median time against the estimate", async () => {
    const body = text(await render());
    expect(body).toContain("Davet");
    expect(body).toContain("Başladı");
    expect(body).toContain("Tamamladı");
    // Fix round 1, I2: the time is wall clock, said so, and compared with the promised estimate.
    expect(body).toContain("Ortanca süre 20 dk (baştan sona, molalar dahil) · tahmin 25 dk");
    expect(body).toContain("Tüm adaylar");
    expect(body).not.toContain("Ortanca süre tahminden belirgin uzun.");
  });

  it("says neutrally when the median is clearly over the estimate, without advice about stage timings", async () => {
    stageSeconds = 600;
    const body = text(await render());
    expect(body).toContain("Ortanca süre 20 dk (baştan sona, molalar dahil) · tahmin 10 dk");
    expect(body).toContain("Ortanca süre tahminden belirgin uzun.");
    expect(body).not.toContain("aşama sürelerine");
  });

  it("says so before the first invitation", async () => {
    invited = 0;
    const body = text(await render());
    expect(body).toContain("Henüz aday yok. İlk daveti açınca huni burada görünür.");
    expect(body).not.toContain("Aday deneyimi");
  });

  it("shows the oldest whole batch of five: its average and unnamed comments, never a date or a rating per comment", async () => {
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
    // Fix round 1, I1: six answers release the oldest five; the sixth ("Kısa", rating 4) is nowhere.
    expect(body).toContain("4,2/5 · 5 cevap");
    expect(body).toContain("Gizlilik için her 5 cevapta ve bir gün gecikmeyle güncellenir.");
    expect(["Akıcıydı", "Uzundu", "Net"].filter((c) => body.includes(c))).toHaveLength(3);
    expect(dump(page)).not.toContain("Kısa");
    // Only the average carries "/5": no comment has its own rating beside it.
    expect(body.match(/\/5/g)).toHaveLength(1);
    const all = dump(page);
    // Positive controls: the dump carries the shown comments and the dates the page does hand on.
    expect(["Akıcıydı", "Uzundu", "Net"].filter((c) => all.includes(c))).toHaveLength(3);
    expect(all).toContain(NOW.toISOString());
    expect(all).not.toContain("2001-02-03");
    expect(all).not.toContain(String(SENTINEL_AT.getTime()));
    expect(all).not.toContain('"rating"');
  });

  it("shows the same comments in the same order on every reload", async () => {
    answers = Array.from({ length: 10 }, (_, i) => ({ rating: 4, comment: `Yorum ${i}` }));
    const order = (body: string) => answers.map((a) => a.comment!).filter((c) => body.includes(c)).sort((x, y) => body.indexOf(x) - body.indexOf(y));
    const first = order(text(await render()));
    expect(first).toHaveLength(3);
    for (let i = 0; i < 5; i++) expect(order(text(await render()))).toEqual(first);
  });

  it("below five answers shows no comment and no live count, only how many are needed", async () => {
    answers = [
      { rating: 1, comment: "Kötüydü" },
      { rating: 2, comment: "Uzundu" },
      { rating: 5, comment: "İyi" },
      { rating: 4, comment: "Net" },
    ];
    const page = await render();
    const body = text(page);
    expect(body).toContain("5 cevap gelince, en az bir gün sonra görünür.");
    expect(body).not.toContain("şu an");
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

const BASE = `/hiring/openings/${OPENING}`;
const DRAFT = { ...LIVE, id: "d", number: 1, status: "DRAFT", publishedAt: null, previewedAt: null };
/** A draft whose one question measures a competency: the assessment and the anchors are done, the team too (a reviewer and an active owner deciding). */
const ready = () => content([stage("s1", [activity("a1", { competencyIds: ["c1"] })])], { id: "d" });
const publishSwitch = (page: ReactElement) => find(page, ofType(PublishSwitch))[0];
type MenuItem = { label: string; href: string; detail?: string };

describe("a draft's control view and its setup path (4.5, H7)", () => {
  beforeEach(() => {
    status = "DRAFT";
    state = { draft: DRAFT, live: null, content: ready(), problems: [] };
    invited = 0;
  });

  it("has one filled button, 'Kuruluma devam et', to the path's next step, and no 'Yayınla' in the header", async () => {
    const page = await render();
    const action = header(page).props.action as ReactElement;
    expect(text(action)).toBe("Kuruluma devam et");
    // B-M6: drawn through HashAwareLink, a Next link for a target without a hash.
    const [next] = find(action, ofType(HashAwareLink));
    expect(next.props.href).toBe(`${BASE}/assessment/preview`);
    expect((HashAwareLink(next.props as unknown as Parameters<typeof HashAwareLink>[0]) as ReactElement).type).toBe(Link);
    expect(text(action)).not.toContain("Yayınla");
    // No setup line on the overview itself: its setup card says the same one line lower.
    expect(header(page).props.setup).toBeUndefined();
    const body = text(page);
    expect(body).toContain("Yayına hazırlık");
    expect(body).toContain("Kurulum 3 / 5");
    expect(body).toContain("2 adım kaldı.");
    // The current step (the advised preview) offers its page and "Atla ›"; the last step is "Yayınla".
    const steps = find(page, ofType(PathSteps))[0].props.steps as Array<{ title: string; state: string; action?: ReactNode }>;
    expect(steps.map((s) => [s.title, s.state])).toEqual([
      ["Değerlendirmeyi kur", "done"],
      ["Puan kartındaki her yetkinliğe çapa ver", "done"],
      ["Ekibi ata", "done"],
      ["Adayın göreceğini önizle", "current"],
      ["Yayınla", "todo"],
    ]);
    expect(text(steps[3].action)).toBe("ÖnizleAtla");
    expect(find(steps[3].action, (el) => typeof el.props.href === "string").map((l) => l.props.href)).toEqual([`${BASE}/assessment/preview`, `${BASE}?skip=preview`]);
    // M6: "Atla" keeps the scroll place.
    expect(find(steps[3].action, ofType(Link))[0].props.scroll).toBe(false);
  });

  it("goes on to the publish summary as a plain anchor once the advice is skipped (?skip=)", async () => {
    sp = { skip: "preview" };
    const action = header(await render()).props.action as ReactElement;
    // M3: the summary opens as a marked history entry (PublishLink), a plain anchor without JavaScript.
    const [anchor] = find(action, ofType(PublishLink));
    expect(anchor.props.href).toBe(`${BASE}#publish`);
    expect(text(anchor)).toBe("Kuruluma devam et");
  });

  it("draws the publish summary for an editor: what goes live, each row with its change link, and the one filled 'Yayınla'", async () => {
    const summary = publishSwitch(await render()).props.summary as ReactElement;
    expect(summary).toBeTruthy();
    expect(find(summary, ofType(StepScreen))[0].props.title).toBe("Yayına hazır mı?");
    const [footer] = find(summary, ofType(PublishFooter));
    expect(footer.props).toMatchObject({ formId: "publish-form", reason: null, fix: null, labels: { publish: "Yayınla", publishing: "Yayınlanıyor", back: "Genel bakış" } });
    const [form] = find(summary, (el) => el.type === "form");
    expect(form.props.id).toBe("publish-form");
    const rows = find(summary, (el) => Array.isArray(el.props.rows))[0].props.rows as Array<{ id: string; value: string; edit?: { href: string } }>;
    expect(rows.map((r) => r.id)).toEqual(["version", "team", "deadline", "preview"]);
    expect(rows[0].value).toBe("v1 · 1 aşama · 1 soru · ~10 dk");
    expect(rows[1].value).toBe("1 değerlendirici · karar: Sahip");
    expect(rows[3].value).toBe("Önizlenmedi; önerilir, yayını engellemez.");
    // A hash target on team and rules is a step of its flow (Task 21: #team-members, #contact-deadline).
    expect(rows.map((r) => r.edit?.href)).toEqual([`${BASE}/assessment/edit`, `${BASE}/settings#team-members`, `${BASE}/settings#contact-deadline`, `${BASE}/assessment/preview`]);
  });

  it("makes 'Yayınla' wait with the gate's first problem and a 'Düzelt' link to its place", async () => {
    state = { ...state, content: content([stage("s1", [activity("a1", { competencyIds: ["c1"], prompt: { tr: "", en: "" } })])], { id: "d" }), problems: [{ code: "EMPTY_PROMPT", activityId: "a1" }] };
    const summary = publishSwitch(await render()).props.summary as ReactElement;
    const [footer] = find(summary, ofType(PublishFooter));
    expect(footer.props.reason).toBe("Aşama 1, soru 1: soru metni boş.");
    expect(footer.props.fix).toEqual({ label: "Düzelt", href: `${BASE}/assessment/edit?activity=a1` });
  });

  it("gives a reviewer the path's state but no step action, no summary and no filled button", async () => {
    viewer = { role: "REVIEWER", edit: false };
    const page = await render();
    expect(header(page).props.action).toBeNull();
    expect(publishSwitch(page).props.summary).toBeNull();
    expect(text(page)).toContain("Yayına hazırlık");
    const steps = find(page, ofType(PathSteps))[0].props.steps as Array<{ action?: ReactNode }>;
    expect(steps.every((s) => s.action === undefined)).toBe(true);
    expect(find(page, (el) => el.props.href === `${BASE}#publish`)).toHaveLength(0);
  });

  it("draws the setup card as the mockup's: the count as the heading, the lead, the stage drawing and the path in the setup look (mockup 5)", async () => {
    const page = await render();
    const [path] = find(page, ofType(PathSteps));
    expect(path.props.look).toBe("setup");
    expect(find(page, (el) => el.type === Illustration && el.props.name === "stage")).toHaveLength(1);
    const [heading] = find(page, (el) => el.props.id === SETUP_HEADING_ID);
    expect(text(heading)).toBe("Kurulum 3 / 5 · 2 adım kaldı.");
    expect(text(page)).toContain("Yayınlayınca adaylarını davet edebilirsin.");
  });
});

describe("the opening's ⋯ menu (plan decision 14, ruling C9)", () => {
  it("holds links only: preview, team and rules (where closing lives) and 'Kopyala' for someone who may open an opening", async () => {
    const menu = header(await render()).props.menu as MenuItem[];
    expect(menu).toEqual([
      { label: "Adayın göreceğini önizle", href: `${BASE}/assessment/preview` },
      { label: "Ekip ve kurallar", detail: "Alımı kapatmak da burada.", href: `${BASE}/settings` },
      { label: "Kopyala", href: `/hiring/openings/new?copy=${OPENING}` },
    ]);
  });

  it("gives a reviewer no 'Kopyala' (its page would refuse them) and no word about closing", async () => {
    viewer = { role: "REVIEWER", edit: false };
    const menu = header(await render()).props.menu as MenuItem[];
    expect(menu.map((i) => i.label)).toEqual(["Adayın göreceğini önizle", "Ekip ve kurallar"]);
    expect(menu.some((i) => i.detail)).toBe(false);
  });
});

describe("a live opening's attention and rules (4.5, H9, ruling C6)", () => {
  it("says the open requests and the links about to expire, each leading to the Candidates tab", async () => {
    requestRows = 2;
    expiringRows = 1;
    const page = await render();
    const body = text(page);
    expect(body).toContain("Dikkat isteyenler");
    expect(body).toContain("2 açık talep");
    expect(body).toContain("1 link 48 saatte doluyor");
    expect(body).toContain("Taleplere bak");
    expect(body).toContain("Linklere bak");
  });

  it("shows a reviewer the expiring count only (H9: counts, no requests) and never reads the requests", async () => {
    viewer = { role: "REVIEWER", edit: false };
    requestRows = 2;
    expiringRows = 1;
    const body = text(await render());
    expect(body).toContain("1 link 48 saatte doluyor");
    expect(body).not.toContain("açık talep");
    expect(fake.ops.some((o) => o.table === "candidate_requests" || o.table === "deletion_requests")).toBe(false);
  });

  it("says a team below the rule and a passed last day, each leading to its step of team and rules (B-M3)", async () => {
    teamCount = 1;
    minEvaluations = 2;
    openingDeadlineAt = new Date("2020-01-10T20:59:59Z");
    const page = await render();
    const body = text(page);
    expect(body).toContain("Dikkat isteyenler");
    expect(body).toContain("Ekipte 1 değerlendirici var, kural 2 istiyor.");
    expect(body).toContain("Son gün geçti; yeni davet açılamaz.");
    const hrefs = find(page, (el) => typeof el.props.href === "string").map((el) => el.props.href);
    expect(hrefs).toContain(`${BASE}/settings#team-members`);
    expect(hrefs).toContain(`${BASE}/settings#contact-deadline`);
    // A reviewer is told neither (H9: they cannot act on it, and no invite form is read for them).
    viewer = { role: "REVIEWER", edit: false };
    const reviewer = text(await render());
    expect(reviewer).not.toContain("kural 2 istiyor");
    expect(reviewer).not.toContain("Son gün geçti");
  });

  it("stays silent without anything to attend to", async () => {
    expect(text(await render())).not.toContain("Dikkat isteyenler");
  });

  it("reads no counts for a closed opening (facts only for live openings)", async () => {
    status = "CLOSED";
    viewer = { role: "OWNER", edit: false };
    expiringRows = 1;
    const body = text(await render());
    expect(body).not.toContain("Dikkat isteyenler");
    expect(body).not.toContain("Bu alımın kuralları");
    expect(fake.ops.some((o) => o.table === "assessment_links")).toBe(false);
  });

  it("shows the opening's rules in one card, with 'Kuralları değiştir' only for an editor", async () => {
    const page = await render();
    const body = text(page);
    expect(body).toContain("Bu alımın kuralları");
    expect(body).toContain("Kuralları değiştir");
    const rules = find(page, (el) => el.props.readOnly === true)[0].props.rows as Array<{ value: string }>;
    expect(rules.map((r) => r.value)).toEqual(["1 değerlendirici · karar: Sahip", "Son tarih yok · 7 günde dönüş", "Kimlik açık · bitiş anketi açık"]);
    viewer = { role: "REVIEWER", edit: false };
    const reviewer = text(await render());
    expect(reviewer).toContain("Bu alımın kuralları");
    expect(reviewer).not.toContain("Kuralları değiştir");
  });
});

describe("the team line names only who can decide and counts the active members (fix round 1, I1)", () => {
  const summaryRows = async () => {
    const summary = publishSwitch(await render()).props.summary as ReactElement;
    return find(summary, (el) => Array.isArray(el.props.rows))[0].props.rows as Array<{ id: string; value: string }>;
  };
  beforeEach(() => {
    status = "DRAFT";
    state = { draft: DRAFT, live: null, content: ready(), problems: [] };
    invited = 0;
  });

  it("says nobody decides while the decider is disabled, as the setup path does", async () => {
    people = [person(OWNER, "Sahip", "OWNER", NOW), person(REVIEWER, "Ece", "REVIEWER")];
    expect((await summaryRows())[1].value).toBe("1 değerlendirici · karar: kimse seçilmedi");
    const steps = find(await render(), ofType(PathSteps))[0].props.steps as Array<{ title: string; detail?: string }>;
    expect(steps[2].detail).toBe("Aktif bir karar veren yok. Ekip ve kurallarda bir sahip ya da yönetici seç.");
  });

  it("says nobody decides while the decider was demoted to reviewer", async () => {
    people = [person(OWNER, "Sahip", "REVIEWER"), person(REVIEWER, "Ece", "REVIEWER")];
    expect((await summaryRows())[1].value).toBe("1 değerlendirici · karar: kimse seçilmedi");
  });

  it("does not count a disabled member, on the summary and on a live opening's rules card", async () => {
    people = [person(OWNER, "Sahip", "OWNER"), person(REVIEWER, "Ece", "REVIEWER", NOW)];
    expect((await summaryRows())[1].value).toBe("Değerlendirici yok · karar: Sahip");
    status = "OPEN";
    state = { draft: null, live: LIVE };
    invited = 3;
    const rules = find(await render(), (el) => el.props.readOnly === true)[0].props.rows as Array<{ value: string }>;
    expect(rules[0].value).toBe("Değerlendirici yok · karar: Sahip");
  });
});

describe("the overview's reads (B-M5, ruling C21)", () => {
  it("reads the working state, the people, the funnel and the invite form one after another, never side by side", async () => {
    await render();
    const first = (prefix: string) => order.findIndex((e) => e.startsWith(prefix));
    expect(order.slice(0, 4)).toEqual(["working:start", "working:end", "people:start", "people:end"]);
    // The funnel (hiring_assessments) after the people, the invite form (hiring_openings) after the funnel.
    expect(first("db:hiring_assessments")).toBeGreaterThan(order.indexOf("people:end"));
    expect(first("db:hiring_openings")).toBeGreaterThan(first("db:hiring_assessments"));
  });
});

describe("the published notice takes the focus once the summary is gone (B-M2)", () => {
  it("draws the notice focusable by script, with the id the summary's switch looks for", async () => {
    sp = { published: "2" };
    const page = await render();
    const [notice] = find(page, (el) => el.props.role === "status" && el.props.id === PUBLISHED_NOTICE_ID);
    expect(notice.props.tabIndex).toBe(-1);
    expect(text(notice as ReactElement)).toContain("v2 yayınlandı.");
  });
});

describe("a disabled member keeps the team step open (B-M1)", () => {
  it("names the disabled member on the path and leads to the team's members step", async () => {
    status = "DRAFT";
    state = { draft: DRAFT, live: null, content: ready(), problems: [] };
    invited = 0;
    people = [person(OWNER, "Sahip", "OWNER"), person(REVIEWER, "Ece", "REVIEWER", NOW)];
    const page = await render();
    const steps = find(page, ofType(PathSteps))[0].props.steps as Array<{ title: string; state: string; detail?: string }>;
    expect([steps[2].title, steps[2].state, steps[2].detail]).toEqual(["Ekibi ata", "current", "Ekipte devre dışı bir kullanıcı var. Ekip ve kurallarda onu çıkar ya da yerine birini ekle."]);
    expect(text(header(page).props.action as ReactElement)).toBe("Kuruluma devam et");
    expect(dump(header(page).props.action as ReactNode)).toContain(`${BASE}/settings#team-members`);
  });
});

describe("small fixes of round 1", () => {
  it("M1: says the reply days with a plural in English, the Turkish line unchanged", () => {
    expect(managerT("en")("hiringCommon.rulesContact", { deadline: "No deadline", days: 1 })).toBe("No deadline · reply within 1 day");
    expect(managerT("en")("hiringCommon.rulesContact", { deadline: "No deadline", days: 7 })).toBe("No deadline · reply within 7 days");
    expect(managerT("tr")("hiringCommon.rulesContact", { deadline: "Son tarih yok", days: 7 })).toBe("Son tarih yok · 7 günde dönüş");
  });

  it("B-M7: says 'evaluators' in English, the word the team flow and the invite form use", () => {
    const en = managerT("en");
    expect(en("hiringCommon.rulesTeam", { count: 0, decider: "Kadir" })).toBe("No evaluators · decides: Kadir");
    expect(en("hiringCommon.rulesTeam", { count: 1, decider: "Kadir" })).toBe("One evaluator · decides: Kadir");
    expect(en("hiringCommon.rulesTeam", { count: 3, decider: "Kadir" })).toBe("3 evaluators · decides: Kadir");
  });

  it("M3: the path's last step opens the summary through PublishLink", async () => {
    status = "DRAFT";
    state = { draft: DRAFT, live: null, content: ready(), problems: [] };
    invited = 0;
    sp = { skip: "preview" };
    const steps = find(await render(), ofType(PathSteps))[0].props.steps as Array<{ title: string; action?: ReactNode }>;
    const [link] = find(steps[4].action, ofType(PublishLink));
    expect(link.props.href).toBe(`${BASE}#publish`);
    expect(text(link)).toBe("Yayın özetine bak");
  });

  it("M6: 'Atla' keeps ?lang= when the address has one", async () => {
    status = "DRAFT";
    state = { draft: DRAFT, live: null, content: ready(), problems: [] };
    invited = 0;
    sp = { lang: "en" };
    const steps = find(await render(), ofType(PathSteps))[0].props.steps as Array<{ action?: ReactNode }>;
    expect(find(steps[3].action, ofType(Link))[0].props.href).toBe(`${BASE}?skip=preview&lang=en`);
  });
});

