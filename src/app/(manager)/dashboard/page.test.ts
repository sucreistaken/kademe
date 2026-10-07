import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TodayItem } from "@/solutions/types";

/**
 * Today (HIRING-VISUAL-FLOW 4.3, plan 2b Task 17). The page is the live exam's
 * daily screen, so the first block pins what the exam sees: the review queue's
 * rows (words, cells, "İncele", links, order) exactly as the dashboard drew
 * them before M2 (ruling C17: the rows only; the heading and the empty hint
 * change on purpose). The rest pins the new parts: one filled button, the next
 * task (accommodation only, ruling C6), the attention rows with their plain
 * note, the link to hiring's control view (H1) and the empty state.
 */
vi.mock("@/db", () => ({ db: {} }));
let items: TodayItem[] = [];
let role: "OWNER" | "MANAGER" | "REVIEWER" = "OWNER";
let locale: "tr" | "en" = "tr";
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", email: "", name: "", role }) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => locale }));
vi.mock("@/server/links", () => ({ expiringLinks: async () => [{ link: { id: "l1", expiresAt: new Date("2026-10-07T10:00:00Z") }, name: "Ayşe Y." }] }));
vi.mock("@/app/(manager)/actions", () => ({ extendLink: async function extendLink() {} }));
vi.mock("@/solutions/registry.server", async () => {
  const { SOLUTION_MANIFESTS } = await import("@/solutions/registry");
  return { solutionModules: () => SOLUTION_MANIFESTS.map((m) => ({ ...m, today: async () => items.filter((i) => i.solution === m.key) })) };
});

import TodayPage from "./page";
import { Disclosure } from "@/components/visual/disclosure";

function find(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [...(match(element) ? [element] : []), ...find(element.props?.children, match)];
}

const exam = (id: string, iso: string | null, n: number): TodayItem => ({
  id,
  solution: "language-exam",
  lane: "review",
  title: `Öğrenci ${n}`,
  subtitle: `Sınav ${n} · B2`,
  href: `/exam/students/s${n}/results`,
  sortAt: iso ? new Date(iso) : null,
  cells: [
    { kind: "text", text: `Detay ${n}` },
    { kind: "level", text: n % 2 ? "B1" : null, final: n % 3 === 0 },
    { kind: "dot", tone: "warn", text: "AI değerlendiriyor" },
    { kind: "dot", tone: "done", text: "Temiz" },
  ],
});
const running: TodayItem = { id: "run1", solution: "language-exam", lane: "running", title: "Koşan", subtitle: null, href: "/exam/students/run", sortAt: null, cells: [{ kind: "dot", tone: "active", text: "Okuma bölümünde" }] };
const EXAM = () => [exam("b", "2026-10-03T10:00:00Z", 2), running, exam("a", "2026-10-01T10:00:00Z", 1), exam("c", null, 3), exam("d", "2026-10-02T09:00:00Z", 4)];
const accommodation: TodayItem = { id: "hiring:request:1", solution: "hiring", lane: "task", task: "ACCOMMODATION", title: "Ece Bal bir uyarlama istedi", subtitle: "Ürün Tasarımcısı", detail: "Video yerine yazılı cevap verebilir miyim?", href: "/hiring/openings/op1/candidates", sortAt: new Date("2026-09-20T00:00:00Z"), cells: [] };
const requestsRow: TodayItem = { id: "hiring:requests:op1", solution: "hiring", lane: "attention", attention: "requests", title: "2 açık talep", subtitle: "Ürün Tasarımcısı", detail: "Biri veri hakkı talebi; panelden henüz kapatılmaz.", href: "/hiring/openings/op1/candidates", sortAt: new Date("2026-09-20T00:00:00Z"), cells: [] };
const draftRow: TodayItem = { id: "hiring:draft:op2", solution: "hiring", lane: "attention", attention: "draft", title: "Taslak v1 yayın bekliyor", subtitle: "Destek Uzmanı", actionLabel: "Kuruluma devam et", href: "/hiring/openings/op2", sortAt: null, cells: [] };

async function render(given: TodayItem[], as: typeof role = "OWNER", lang: typeof locale = "tr") {
  items = given;
  role = as;
  locale = lang;
  return renderToStaticMarkup((await TodayPage({ searchParams: Promise.resolve({}) })) as never);
}
const text = (html: string) => html.replace(/<[^>]+>/g, "\n").replace(/&quot;/g, '"').replace(/\n+/g, "\n").trim();
/** The manager's review rows: the anchors of the section headed "Senin kararını bekleyenler". */
function queueRows(html: string) {
  const section = html.match(/<h2[^>]*>(?:Senin kararını bekleyenler|Waiting for your decision)[\s\S]*?<\/section>/)?.[0] ?? "";
  return (section.match(/<a [\s\S]*?<\/a>/g) ?? []).map((a) => ({ href: a.match(/href="([^"]*)"/)?.[1], text: text(a) }));
}
const filled = (html: string) => html.match(/data-variant="primary"/g)?.length ?? 0;
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), to ? html.indexOf(to) : undefined);

beforeEach(() => {
  // Waiting times are read against "now"; the fixtures' dates are early October 2026.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-07T12:00:00Z") });
  items = [];
  role = "OWNER";
  locale = "tr";
});

afterEach(() => vi.useRealTimers());

describe("what the live exam sees on Today", () => {
  // Words, cells and order of the exam's rows; the date line under the name became "N gündür bekliyor" (an undated row keeps its subtitle).
  const BEFORE = [
    { href: "/exam/students/s3/results", text: "Öğrenci 3\nSınav 3 · B2\nDetay 3\nB1\nAI değerlendiriyor\nTemiz\nİncele" },
    { href: "/exam/students/s1/results", text: "Öğrenci 1\n6 gündür bekliyor\nDetay 1\nB1\nAI değerlendiriyor\nTemiz\nİncele" },
    { href: "/exam/students/s4/results", text: "Öğrenci 4\n5 gündür bekliyor\nDetay 4\n-\nAI değerlendiriyor\nTemiz\nİncele" },
    { href: "/exam/students/s2/results", text: "Öğrenci 2\n4 gündür bekliyor\nDetay 2\n-\nAI değerlendiriyor\nTemiz\nİncele" },
  ];

  it("keeps the review queue's rows exactly: words, cells, 'İncele', links and order (C17)", async () => {
    expect(queueRows(await render(EXAM()))).toEqual(BEFORE);
    expect(queueRows(await render(EXAM(), "REVIEWER"))).toEqual(BEFORE);
    // Hiring's rows never enter the exam's queue.
    expect(queueRows(await render([...EXAM(), accommodation, requestsRow, draftRow]))).toEqual(BEFORE);
  });

  it("keeps an empty queue's row count at zero and the expiring links' '7 gün uzat'", async () => {
    const html = await render([running]);
    expect(queueRows(html)).toEqual([]);
    expect(text(between(html, "48 saat içinde dolacak linkler", ""))).toContain("Ayşe Y.\n07 Eki 13:00\n7 gün uzat");
    expect(html).toContain('<input type="hidden" name="back" value="/dashboard"/>');
  });

  it("says the head in sen, counts the queue and names the oldest row, and points at that row as the next task", async () => {
    const html = await render(EXAM());
    expect(text(between(html, "<h1", "<section"))).toContain("Bugün\n4 iş senin kararını bekliyor. En eskisi");
    const card = between(html, 'aria-labelledby="today-next"', "</section>");
    expect(card).toContain("Öğrenci 3");
    expect(card).toContain('href="/exam/students/s3/results"');
    expect(text(card)).toContain("İncele");
    // The pointer does not take the row out of the queue.
    expect(queueRows(html)[0].text.startsWith("Öğrenci 3")).toBe(true);
  });

  it("adds no exam link under the attention rows; the hiring control view is linked for everyone (H1)", async () => {
    for (const as of ["OWNER", "REVIEWER"] as const) {
      const html = await render(EXAM(), as);
      expect(html.match(/href="\/hiring\/openings"/g)?.length).toBe(1);
      expect(text(html)).toContain("Tüm alımların durumu");
    }
  });

  it("keeps the running list's rows behind a disclosure with its count", async () => {
    const html = await render(EXAM());
    expect(text(html)).toContain("Süren sınavlar (1)");
    const tree = await TodayPage({ searchParams: Promise.resolve({}) });
    // The first disclosure is the AI's list; the running list is the second.
    const [, disclosure] = find(tree, (el) => el.type === Disclosure);
    const rows = renderToStaticMarkup(disclosure.props.children as ReactElement);
    // The row's markup as the dashboard drew it before (same capture as BEFORE).
    expect(rows).toContain(
      '<a class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas" href="/exam/students/run"><span class="text-[14px] font-medium text-ink">Koşan</span>',
    );
    expect(text(rows)).toBe("Koşan\nOkuma bölümünde");
  });
});

describe("one filled button on Today (RULES 2, 4.3)", () => {
  it("gives it to the next task and turns the invite outline", async () => {
    const html = await render([...EXAM(), accommodation, requestsRow]);
    expect(filled(html)).toBe(1);
    expect(between(html, 'aria-labelledby="today-next"', "</section>")).toContain('data-variant="primary"');
    expect(html).toMatch(/id="today-invite"[^>]*data-variant="secondary"|data-variant="secondary"[^>]*id="today-invite"/);
  });

  it("fills the invite when only attention rows wait", async () => {
    const html = await render([draftRow]);
    expect(filled(html)).toBe(1);
    expect(html).not.toContain('aria-labelledby="today-next"');
    expect(html).toMatch(/id="today-invite"[^>]*data-variant="primary"|data-variant="primary"[^>]*id="today-invite"/);
  });

  it("moves the invite into the empty state when nothing waits, nothing filled in the header", async () => {
    const html = await render([running]);
    expect(filled(html)).toBe(1);
    expect(text(html)).toContain("Bugün bekleyen iş yok.\nYeni bir aday ya da öğrenci davet edebilirsin.");
    expect(between(html, "<h1", "Bugün bekleyen iş yok.")).not.toContain("today-invite");
    expect(text(between(html, "<h1", "<section"))).toContain("Bekleyen iş yok.");
  });

  it("says the empty queue's invite hint only as a second way to the invite (Task 17 review)", async () => {
    const hint = "Yeni bir öğrenci davet et";
    expect(text(await render([running]))).not.toContain(hint);
    expect(text(await render([running], "REVIEWER"))).not.toContain(hint);
    expect(text(await render([running, draftRow]))).toContain(hint);
    expect(text(await render([running, draftRow], "REVIEWER"))).not.toContain(hint);
  });

  it("states the reason next to a disabled invite (a reviewer may invite for nothing)", async () => {
    const html = await render([running], "REVIEWER");
    expect(html).toContain('aria-describedby="today-invite-why"');
    expect(text(html)).toContain("Rolün davet açamaz.");
  });
});

describe("hiring's rows on Today", () => {
  it("makes the accommodation request the next task, quoted, with 'Talebe bak' to the Candidates tab", async () => {
    const html = await render([...EXAM(), accommodation, requestsRow]);
    const card = between(html, 'aria-labelledby="today-next"', "</section>");
    expect(text(card)).toContain("Sıradaki iş\n·\nİşe alım\nEce Bal bir uyarlama istedi\n“Video yerine yazılı cevap verebilir miyim?”");
    expect(card).toContain('href="/hiring/openings/op1/candidates"');
    expect(text(card)).toContain("Talebe bak");
  });

  it("counts the accommodation request once in the head (its task and its opening's requests row)", async () => {
    const html = await render([accommodation, requestsRow]);
    expect(text(between(html, "<h1", "<section"))).toContain("1 iş senin kararını bekliyor.");
  });

  it("lists attention rows with their own action and the data-rights note as plain text, no button (C6)", async () => {
    const html = await render([accommodation, requestsRow, draftRow]);
    const list = between(html, 'aria-labelledby="today-attention"', 'id="today-you"');
    expect(text(list)).toContain("2 açık talep\nÜrün Tasarımcısı\nBiri veri hakkı talebi; panelden henüz kapatılmaz.\nİşe alım\nAç");
    expect(text(list)).toContain("Taslak v1 yayın bekliyor\nDestek Uzmanı\nİşe alım\nKuruluma devam et");
    expect(list).not.toContain("<button");
    expect(list).not.toContain("data-variant");
  });

  it("reads in English with the same parts", async () => {
    const html = await render([accommodation, requestsRow], "OWNER", "en");
    expect(text(html)).toContain("Today\n1 thing waits for you.");
    expect(text(html)).toContain("Next up\n·\nHiring");
    expect(text(html)).toContain("Look at the request");
    expect(text(html)).toContain("Needs attention");
    expect(text(html)).toContain("Where every opening stands");
    expect(text(html)).toContain("Waiting for your decision (0)");
  });

  it("draws the next task as the mockup's card: the drawing, the eyebrow and the one filled button under the text (mockup 1)", async () => {
    const html = await render([...EXAM(), accommodation, requestsRow]);
    const card = between(html, 'aria-labelledby="today-next"', "</section>");
    // inviteReady's tint circle.
    expect(card).toContain('cx="26" cy="26" r="9"');
    expect(card).toMatch(/<h2 id="today-next"[^>]*>Sıradaki iş<\/h2>/);
    expect(card).toMatch(/<a[^>]*data-variant="primary"[^>]*>Talebe bak<\/a>|<a[^>]*id="today-next-action"[^>]*>Talebe bak<\/a>/);
    expect(filled(html)).toBe(1);
  });

  it("draws the drawing only for a hiring next task; an exam next task keeps the card without it", async () => {
    const hiring = between(await render([accommodation]), 'aria-labelledby="today-next"', "</section>");
    expect(hiring).toContain('cx="26" cy="26" r="9"');
    const examCard = between(await render(EXAM()), 'aria-labelledby="today-next"', "</section>");
    expect(examCard).toContain("İncele");
    expect(examCard).not.toContain("<svg");
    expect(examCard).not.toContain('cx="26" cy="26" r="9"');
  });

  it("gives every attention row a soft icon tile, its solution as a chip and its action as text (mockup 1)", async () => {
    const html = await render([accommodation, requestsRow, draftRow]);
    const list = between(html, 'aria-labelledby="today-attention"', 'id="today-you"');
    expect(list.match(/bg-accent-soft text-accent/g)).toHaveLength(2);
    expect(list).toContain("lucide-inbox");
    expect(list).toContain("lucide-file-pen-line");
    expect(list.match(/rounded-full bg-row-line/g)).toHaveLength(2);
    expect(list).not.toContain("data-variant");
  });

  it("draws the expiring row's clock tile neutral, never accent (the plan's global constraint)", async () => {
    const expiringRow: TodayItem = { id: "hiring:expiring:op1", solution: "hiring", lane: "attention", attention: "expiring", title: "3 bağlantı doluyor", subtitle: "Ürün Tasarımcısı", href: "/hiring/openings/op1/candidates", sortAt: null, cells: [] };
    const html = await render([requestsRow, expiringRow, draftRow]);
    const list = between(html, 'aria-labelledby="today-attention"', 'id="today-you"');
    expect(list.match(/bg-accent-soft text-accent/g)).toHaveLength(2);
    expect(list.match(/bg-secondary text-ink/g)).toHaveLength(1);
    expect(list.slice(list.indexOf("bg-secondary text-ink"), list.indexOf("3 bağlantı doluyor"))).toContain("lucide-clock");
  });
});

describe("Today at one look", () => {
  const aiExam = (n: number): TodayItem => ({ ...exam(`ai${n}`, `2026-10-0${n}T10:00:00Z`, 10 + n), waitingOn: "ai" });

  it("keeps the AI's unfinished results out of the manager's list and counts them apart", async () => {
    const html = await render([...EXAM(), aiExam(1), aiExam(2)]);
    expect(queueRows(html)).toHaveLength(4);
    expect(text(html)).toContain("Senin kararını bekleyenler (4)");
    expect(text(html)).toContain("AI hazırlıyor (2)");
    expect(html).toContain("2 sonuç AI&#x27;dan çıkınca hazır olacak.");
    expect(html).not.toContain("Öğrenci 11");
  });

  it("opens with four tiles, each a link to its part of the page, and a fifth for hiring's control view", async () => {
    const html = await render([...EXAM(), aiExam(1), requestsRow]);
    const nav = between(html, "<nav", "</nav>");
    expect(text(nav)).toContain("Senin kararın\n5\nşimdi bakılacaklar");
    expect(text(nav)).toContain("AI hazırlıyor\n1\nsenden bir şey beklemiyor");
    expect(text(nav)).toContain("Sınavda\n1");
    expect(text(nav)).toContain("Dolacak link\n1");
    for (const target of ["#today-you", "#today-ai", "#today-running", "#today-expiring", "/hiring/openings"]) expect(nav).toContain(`href="${target}"`);
    expect(text(nav)).toContain("İşe alım\n1\nTüm alımların durumu");
  });

  it("says why the next task is first and what it needs", async () => {
    const card = between(await render(EXAM()), 'aria-labelledby="today-next"', "</section>");
    expect(text(card)).toContain("Önce bu: en uzun bekleyen");
  });

  it("shows only the first eight decisions and links to the rest", async () => {
    const many = Array.from({ length: 11 }, (_, i) => exam(`m${i}`, `2026-10-01T0${i % 10}:00:00Z`, 20 + i));
    const html = await render(many);
    expect(queueRows(html)).toHaveLength(8 + 1);
    expect(text(html)).toContain("Tümünü gör (11)");
    expect(html).toContain('href="/exam/students?tab=review"');
  });
});
