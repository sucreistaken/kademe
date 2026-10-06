import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpeningListRow } from "@/solutions/hiring/server/openings";
import type { CockpitRow } from "./cockpit";

/**
 * The openings' control view (HIRING-VISUAL-FLOW 4.4, plan 2b Task 18) as the
 * page draws it from loadCockpit's rows: one filled button, groups with the
 * old ?tab= links landing on them (H8), a reviewer's counts only (H9), and a
 * closed opening's one action (KG1).
 */
vi.mock("@/db", () => ({ db: {} }));
let role: "OWNER" | "MANAGER" | "REVIEWER" = "OWNER";
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", email: "", name: "", role }) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));
const cockpit = vi.hoisted(() => ({ value: { runs: true, drafts: [] as unknown[], open: [] as unknown[], closed: [] as unknown[] } }));
vi.mock("./cockpit", () => ({ loadCockpit: async () => cockpit.value }));

import OpeningsPage from "./page";

const opening = (id: string, status: OpeningListRow["status"], over: Partial<OpeningListRow> = {}): OpeningListRow => ({
  id,
  name: `Alım ${id}`,
  status,
  deadlineAt: null,
  positionName: "Pozisyon",
  ownerName: null,
  liveNumber: status === "DRAFT" ? null : 1,
  draftNumber: null,
  decisionMakerId: null,
  memberIds: ["u1"],
  ...over,
});
const draft: CockpitRow = { opening: opening("d1", "DRAFT"), facts: null, setup: { done: 2, total: 5 }, shortfall: null, next: { kind: "setup", href: "/hiring/openings/d1/settings#team-members", setupKey: "team" } };
const live: CockpitRow = {
  opening: opening("o1", "OPEN", { memberIds: ["u1", "u2"] }),
  facts: { invited: 9, started: 8, completed: 8, expiringSoon: 1, requests: { open: 2, rights: 1 } },
  setup: null,
  shortfall: null,
  next: { kind: "requests", href: "/hiring/openings/o1/candidates" },
};
const closed: CockpitRow = { opening: opening("c1", "CLOSED"), facts: { invited: 3, started: 3, completed: 2, expiringSoon: 0, requests: { open: 0, rights: 0 } }, setup: null, shortfall: null, next: { kind: "open", href: "/hiring/openings/c1" } };

async function render(tab?: string) {
  return renderToStaticMarkup((await OpeningsPage({ searchParams: Promise.resolve(tab ? { tab } : {}) })) as never);
}
const text = (html: string) => html.replace(/<[^>]+>/g, "\n").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\n+/g, "\n").trim();
const filled = (html: string) => html.match(/data-variant="primary"/g)?.length ?? 0;

beforeEach(() => {
  role = "OWNER";
  cockpit.value = { runs: true, drafts: [draft], open: [live], closed: [closed] };
});

describe("the openings' control view page (4.4)", () => {
  it("someone who runs openings: the summary sentence, the groups, each row's one next step and one filled 'Alım aç'", async () => {
    const html = await render();
    const words = text(html);
    expect(filled(html)).toBe(1);
    expect(words).toContain("2 alım sürüyor. 1 tanesi kurulumda. 1 tanesinde senden bir şey bekleniyor.");
    expect(words).toContain("Kurulumda (1)");
    expect(words).toContain("Kurulum 2 / 5");
    expect(words).toContain("Sıradaki: Ekibi ata");
    expect(words).toContain("Yayında (1)");
    expect(words).toContain("9 davet · 8 başladı · 8 tamamladı");
    expect(words).toContain("3 açık talep");
    expect(words).toContain("Biri veri hakkı talebi; panelden henüz kapatılmaz.");
    expect(words).toContain("1 link 48 saatte doluyor");
    expect(words).toContain("Taleplere bak");
    expect(words).toContain("Ekip: 2 kişi");
    expect(words).toContain("Ekip: yalnız sen");
    expect(html).toContain('href="/hiring/openings/d1/settings#team-members"');
    // The closed openings sit behind their disclosure until it is opened.
    expect(words).toContain("Kapalı alımlar (1)");
    expect(words).not.toContain("Alım c1");
  });

  it("keeps the old ?tab= links: closed opens the closed openings, each with one action 'Aç' (H8, KG1)", async () => {
    const html = await render("closed");
    const closedPart = html.slice(html.indexOf("Kapalı alımlar (1)"));
    expect(text(closedPart)).toContain("Alım c1");
    expect(text(closedPart)).toContain("3 davet · 3 başladı · 2 tamamladı");
    expect(closedPart.match(/<a [^>]*>/g)?.map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual(["/hiring/openings/c1", "/hiring/openings/c1"]);
    expect(text(closedPart).split("\n")).toContain("Aç");
  });

  it("a reviewer: counts only, no request or team line, every action 'Aç', the grey 'Alım aç' with its linked reason (H9, RULES 5)", async () => {
    role = "REVIEWER";
    cockpit.value = {
      runs: false,
      drafts: [{ ...draft, setup: null, next: { kind: "open", href: "/hiring/openings/d1" } }],
      open: [{ ...live, facts: { invited: 9, started: 8, completed: 8, expiringSoon: 1 }, next: { kind: "open", href: "/hiring/openings/o1" } }],
      closed: [],
    };
    const html = await render();
    const words = text(html);
    expect(words).toContain("Üyesi olduğun 2 alım var.");
    expect(words).toContain("9 davet · 8 başladı · 8 tamamladı");
    expect(words).toContain("1 link 48 saatte doluyor");
    expect(words).not.toMatch(/talep|Sıradaki|Kurulum \d|Taleplere|Kuruluma/);
    expect(words.split("\n").filter((w) => w === "Aç")).toHaveLength(2);
    expect(filled(html)).toBe(1);
    const button = html.match(/<button[^>]*data-variant="primary"[^>]*>/)?.[0] ?? "";
    expect(button).toContain("disabled");
    const why = button.match(/aria-describedby="([^"]*)"/)?.[1];
    expect(why).toBeTruthy();
    expect(html).toContain(`id="${why}"`);
    expect(text(html)).toContain("Rolün alım açamaz.");
  });

  it("with no opening: the drawing, 'İlk alımını aç.' and 'Alım aç'; a reviewer gets no button", async () => {
    cockpit.value = { runs: true, drafts: [], open: [], closed: [] };
    let html = await render();
    expect(text(html)).toContain("İlk alımını aç.");
    expect(html).toContain('aria-hidden="true"');
    expect(filled(html)).toBe(1);
    role = "REVIEWER";
    cockpit.value = { runs: false, drafts: [], open: [], closed: [] };
    html = await render();
    expect(text(html)).toContain("Sana atanmış alım yok.");
    expect(filled(html)).toBe(0);
  });
});
