import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import type { OpeningRulesInput } from "@/solutions/hiring/rules/opening-rules";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/app/(manager)/hiring/openings/[id]/settings/actions", () => ({ saveOpeningRulesAction: vi.fn() }));
// A server render reads the hash through noHash; the tests set the address the page is opened on.
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));

import { OpeningSettingsForm, type SettingsUser } from "./opening-settings-form";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;

const users: SettingsUser[] = [
  { id: "owner", name: "Kadir Ay", role: "OWNER", disabled: false },
  { id: "rev", name: "Ece Yıldız", role: "REVIEWER", disabled: false },
];
const gone: SettingsUser = { id: "gone", name: "Mert Öz", role: "MANAGER", disabled: true };
const initial: OpeningRulesInput = {
  name: "Tasarımcı · Ekim",
  memberIds: ["rev"],
  decisionMakerId: "owner",
  backupDecisionMakerId: null,
  minEvaluations: 2,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "",
  finishSurveyEnabled: true,
};
type Options = { canEdit?: boolean; closed?: boolean; hash?: string; locale?: "tr" | "en"; people?: SettingsUser[]; values?: Partial<OpeningRulesInput> };
const render = ({ canEdit = true, closed = false, hash = "", locale = "tr", people = users, values = {} }: Options = {}) => {
  address.hash = hash;
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(
        OpeningSettingsForm,
        { openingId: "o1", initial: { ...initial, ...values }, users: people, today: "2026-10-06", zone: "Türkiye saati", canEdit, closed },
        createElement("p", null, "KAPAT-EYLEMİ"),
      ),
    ),
  );
};
const heading = (out: string) => out.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] ?? null;
const filled = (out: string) => out.match(/bg-accent text-white/g)?.length ?? 0;

describe("team and rules: the summary (4.10, P7, H9)", () => {
  it("shows the four groups with 'Değiştir' each, the locked rule, and the page's close action under them", () => {
    const out = render();
    for (const words of ["Ekip", "Aday iletişimi", "Adil değerlendirme", "Alım adı", "1 değerlendirici · karar: Kadir Ay", "Ece Yıldız · Her adayı en az 2 kişi değerlendirir.", "7 günde dönüş", "Kimlik açık · bitiş anketi açık"]) {
      expect(out).toContain(words);
    }
    expect(out.match(/Değiştir<span class="sr-only">/g)).toHaveLength(4);
    expect(out).toContain("Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür");
    expect(out).toContain("KAPAT-EYLEMİ");
    // The summary is a control view: no filled button of its own, no flow footer.
    expect(filled(out)).toBe(0);
    expect(out).not.toContain("Adım 1");
  });

  it("a reviewer and a closed opening read the same summary: no 'Değiştir', no close action", () => {
    for (const out of [render({ canEdit: false }), render({ closed: true })]) {
      expect(out).toContain("1 değerlendirici · karar: Kadir Ay");
      expect(out).not.toContain("Değiştir");
      expect(out).not.toContain("KAPAT-EYLEMİ");
    }
  });

  it("names a decider only while active and able to decide, counts active members, and says what to fix (Task 20 rule)", () => {
    const out = render({ people: [...users, gone], values: { memberIds: ["rev", "gone"], decisionMakerId: "gone" } });
    expect(out).toContain("1 değerlendirici · karar: kimse seçilmedi");
    // The member who left is still listed (so the team step can take them off), marked.
    expect(out).toContain("Mert Öz (Devre dışı)");
    expect(out).toContain("Karar veren aktif bir sahip ya da yönetici olmalı.");
    // A reviewer reads the same line without the fix sentence.
    const reviewer = render({ canEdit: false, people: [...users, gone], values: { memberIds: ["rev", "gone"], decisionMakerId: "gone" } });
    expect(reviewer).toContain("karar: kimse seçilmedi");
    expect(reviewer).not.toContain("Karar veren aktif bir sahip ya da yönetici olmalı.");
  });

  it("speaks English on an English page", () => {
    const out = render({ locale: "en" });
    expect(out).toContain("One evaluator · decides: Kadir Ay");
    expect(out).toContain("Candidate contact");
    expect(out).toContain("Fair review");
    expect(out).toContain("Each candidate is reviewed by at least 2 people.");
    expect(out.match(/Change<span class="sr-only">/g)).toHaveLength(4);
  });
});

describe("team and rules: links land on their step (W3, Task 19 carry)", () => {
  it("#team-members opens the team flow on 'Kim değerlendirecek?' with its head, its footer and one filled button", () => {
    const out = render({ hash: "#team-members" });
    expect(heading(out)).toBe("Kim değerlendirecek?");
    expect(out).toContain("Ekip ve kurallar · Ekip");
    expect(out).toContain("Adım 1 / 4");
    expect(out).toContain("Özete dön");
    expect(out).toContain(">Çık<");
    expect(out).toMatch(/<button[^>]*id="rules-next"[^>]*>Devam et<\/button>/);
    expect(filled(out)).toBe(1);
    // The summary and the page's close action are not on a flow's step.
    expect(out).not.toContain("KAPAT-EYLEMİ");
    expect(out).not.toContain("Değiştir<span");
  });

  it("#team-decider opens 'Kararı kim verecek?' with only active people who can decide, a stale decider marked and closed", () => {
    const out = render({ hash: "#team-decider", people: [...users, { ...gone, disabled: false, role: "REVIEWER" }] });
    expect(heading(out)).toBe("Kararı kim verecek?");
    expect(out).toContain("Adım 2 / 4");
    expect(out).toMatch(/<input[^>]*name="rules-decider"[^>]*value="owner"/);
    expect(out).not.toMatch(/<input[^>]*name="rules-decider"[^>]*value="rev"/);
    expect(out).not.toMatch(/<input[^>]*name="rules-decider"[^>]*value="gone"/);

    const stale = render({ hash: "#team-decider", people: [...users, gone], values: { decisionMakerId: "gone" } });
    const staleCard = (stale.match(/<input[^>]*>/g) ?? []).find((tag) => tag.includes('name="rules-decider"') && tag.includes('value="gone"')) ?? "";
    expect(staleCard).toContain('disabled=""');
    expect(stale).toMatch(/<button[^>]*id="rules-next"[^>]*disabled=""[^>]*aria-describedby="rules-next-why"/);
    expect(stale).toMatch(/id="rules-next-why"[^>]*>Karar veren aktif bir sahip ya da yönetici olmalı\.</);
  });

  it("#contact-deadline opens 'Son gün ne zaman?' with the zone", () => {
    const out = render({ hash: "#contact-deadline" });
    expect(heading(out)).toBe("Son gün ne zaman?");
    expect(out).toContain("Ekip ve kurallar · Aday iletişimi");
    expect(out).toContain("Türkiye saati");
    expect(out).toContain("Adım 1 / 4");
  });

  it("a link past a step that waits opens that step: #team-review without a decider, #team-decider with a member who left", () => {
    expect(heading(render({ hash: "#team-review", values: { decisionMakerId: null } }))).toBe("Kararı kim verecek?");
    expect(heading(render({ hash: "#team-decider", people: [...users, gone], values: { memberIds: ["rev", "gone"] } }))).toBe("Kim değerlendirecek?");
  });

  it("a reviewer, a closed opening and any other hash get the summary, whatever the address says", () => {
    for (const out of [render({ canEdit: false, hash: "#team-members" }), render({ closed: true, hash: "#contact-deadline" }), render({ hash: "#publish" })]) {
      expect(heading(out)).toBeNull();
      expect(out).toContain("1 değerlendirici · karar: Kadir Ay");
      expect(out).not.toContain("rules-next");
    }
  });

  it("the summary step marks nothing and its 'Kaydet' waits with 'Değişiklik yok.' while nothing changed (W5, P8)", () => {
    const out = render({ hash: "#team-review" });
    expect(heading(out)).toBe("Değişikliklere son bir bak");
    expect(out).toContain("Adım 4 / 4");
    expect(out).not.toContain("· değişti");
    expect(out).toMatch(/<button[^>]*id="rules-save"[^>]*disabled=""[^>]*aria-describedby="rules-save-why"[^>]*>Kaydet<\/button>/);
    expect(out).toMatch(/id="rules-save-why"[^>]*>Değişiklik yok\.</);
    expect(out.match(/Değiştir<span class="sr-only">/g)).toHaveLength(3);
    expect(filled(out)).toBe(1);
  });

  it("the fair review's summary ends with the locked rule; the name is one step with its own 'Kaydet' (H2)", () => {
    const fair = render({ hash: "#fair-review" });
    expect(fair).toContain("Değerlendiriciler birbirinin puanını kendi puanlarını gönderince görür");
    expect(fair).toContain("Adım 3 / 3");
    const name = render({ hash: "#name" });
    expect(heading(name)).toBe("Alımın adı ne olsun?");
    expect(name).toMatch(/<button[^>]*id="rules-save"[^>]*>Kaydet<\/button>/);
    expect(name).not.toContain("Adım 1 / 1");
    expect(name).toContain("Özete dön");
  });

  it("each step speaks English on an English page", () => {
    const out = render({ hash: "#team-members", locale: "en" });
    expect(heading(out)).toBe("Who will review?");
    expect(out).toContain("Step 1 / 4");
    expect(out).toContain(">Continue<");
  });
});

describe("the team flow in the mockup's look (screen 6)", () => {
  it("#team-members: the drawing above the question, people as big cards with round initials and a checkbox at the right, and the count against the rule", () => {
    const out = render({ hash: "#team-members" });
    // emptyCandidates' shadow ellipse.
    expect(out).toContain('ellipse cx="80" cy="104" rx="42" ry="5"');
    expect(out).toMatch(/rounded-full bg-accent-soft font-bold text-accent[^"]*">KA</);
    expect(out).toContain("peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white");
    expect(out).toMatch(/<p aria-live="polite" class="text-\[14px\] text-ink">1 kişi seçili, kural 2 istiyor\.<\/p>/);
  });

  it("says the count with a check once the team meets the rule", () => {
    const out = render({ hash: "#team-members", values: { memberIds: ["owner", "rev"] } });
    expect(out).toMatch(/<p aria-live="polite" class="flex items-center gap-1\.5 text-\[14px\] text-accent"><svg[^>]*lucide-check[\s\S]*?2 kişi seçili, kural 2 istiyor\.<\/p>/);
  });

  it("#team-decider: the deciders as big radio cards; the 1-5 cards keep their square look", () => {
    expect(render({ hash: "#team-decider" })).toContain("rounded-full peer-checked:border-[6px] peer-checked:border-accent");
    const min = render({ hash: "#team-min" });
    expect(min).toContain("min-h-16");
    expect(min).not.toContain("peer-checked:border-[6px]");
  });
});
