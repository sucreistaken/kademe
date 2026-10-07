import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { activity, stage } from "@/solutions/hiring/rules/test-fixtures";
import type { ContentStage } from "@/solutions/hiring/rules/content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }) }));
// Every action is a server module; the wizard calls them only on a click.
vi.mock("@/app/(manager)/hiring/openings/[id]/setup/actions", () => ({ generateAndApplyDraftAction: vi.fn(), reviseAssessmentAction: vi.fn(), undoReviseAction: vi.fn() }));
vi.mock("@/app/(manager)/hiring/openings/[id]/actions", () => ({ publishOpeningAction: vi.fn() }));
vi.mock("@/app/(manager)/hiring/openings/[id]/settings/actions", () => ({ saveOpeningRulesAction: vi.fn() }));
vi.mock("@/app/(manager)/hiring/openings/[id]/assessment/edit/actions", () => ({
  addActivityAction: vi.fn(),
  addStageAction: vi.fn(),
  deleteActivityAction: vi.fn(),
  moveActivityAction: vi.fn(),
  restoreActivityFormAction: vi.fn(),
  saveActivityAction: vi.fn(),
  saveStageAction: vi.fn(),
  setCompetenciesAction: vi.fn(),
  deleteStageAction: vi.fn(),
  moveStageAction: vi.fn(),
  restoreStageFormAction: vi.fn(),
  startDraftAction: vi.fn(),
}));
vi.mock("@/app/(manager)/hiring/openings/[id]/assessment/edit/check-actions", () => ({ checkQuestionsAction: vi.fn() }));
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));

import { SetupWizard } from "./setup-wizard";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const ME = "55555555-5555-4555-8555-555555555555";
const OTHER = "77777777-7777-4777-8777-777777777777";
const STAGES: ContentStage[] = [
  stage("s1", [activity("a1", { prompt: { tr: "Bir trafik kazasını nasıl önlersin?", en: "" } }), activity("a2", { orderIndex: 1, type: "LONG_TEXT", prompt: { tr: "Öğrenciye geri bildirimi nasıl verirsin?", en: "" } })], {
    name: { tr: "Tanışma", en: "Intro" },
    durationSeconds: 900,
  }),
];

const render = (props: { hash?: string; stages?: ContentStage[]; blocking?: { text: string; scorecard: boolean } | null; autoDraft?: boolean; canDraft?: boolean } = {}, locale: "tr" | "en" = "tr") => {
  address.hash = props.hash ?? "";
  const stages = props.stages ?? STAGES;
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(SetupWizard, {
        openingId: "o1",
        kicker: "Alım aç · Sürüş eğitmeni · Ekim",
        locale,
        stages,
        competencies: [],
        autoDraft: props.autoDraft ?? false,
        canDraft: props.canDraft ?? true,
        blocking: props.blocking === undefined ? null : props.blocking,
        scorecard: { count: 3, weights: "equal", href: "/hiring/openings/o1/assessment/scorecard" },
        preview: { stages: [{ id: "s1", name: "Tanışma", minutes: 15, questions: 2 }], minutes: 15, questions: 2, href: "/hiring/openings/o1/assessment/preview" },
        me: ME,
        users: [
          { id: ME, name: "Deniz", role: "OWNER", disabled: false },
          { id: OTHER, name: "Ece", role: "REVIEWER", disabled: false },
        ],
        saved: { name: "Sürüş eğitmeni · Ekim", memberIds: [ME], decisionMakerId: ME, backupDecisionMakerId: null, blindMode: false, deadline: null, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false },
        today: "2026-10-07",
        zone: "TSİ",
        notice: null,
        initialActivity: null,
      }),
    ),
  );
};

describe("step 2 'Sorular' (HIRING-UX 5.20)", () => {
  it("asks what to ask, shows 'Adım 2 / 3', 'AI'a söyle' on top and the stages with their questions", () => {
    const out = render();
    expect(out).toMatch(/<h1[^>]*>Adaya ne soralım\?<\/h1>/);
    expect(out).toContain("Adım 2 / 3");
    expect(out).toMatch(/<label[^>]*for="wizard-tell"[^>]*>AI&#x27;a söyle<\/label>/);
    expect(out).toMatch(/<h2[^>]*>Tanışma<\/h2>/);
    expect(out).toContain("2 soru · 15 dk");
    expect(out).toContain("Bir trafik kazasını nasıl önlersin?");
    expect(out).toContain("Öğrenciye geri bildirimi nasıl verirsin?");
  });

  it("gives every question 'Düzenle', 'AI ile düzelt' and 'Sil', and ends the list with '+ Kendi sorunu ekle'", () => {
    const out = render();
    expect(out.match(/>Düzenle</g)).toHaveLength(2);
    expect(out.match(/>AI ile düzelt</g)).toHaveLength(2);
    expect(out.match(/>Sil</g)).toHaveLength(2);
    expect(out).toMatch(/id="wizard-add-own"[^>]*>.*Kendi sorunu ekle/);
  });

  it("sums the scorecard in one line with 'Değiştir' to the scorecard", () => {
    const out = render();
    expect(out).toContain("3 yetkinlik ölçülüyor · ağırlıklar eşit");
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings\/o1\/assessment\/scorecard"[^>]*>Değiştir/);
  });

  it("has one filled button, 'Devam: önizle ve yayınla', which waits with the gate's first problem", () => {
    expect(render()).toMatch(/<button[^>]*id="wizard-to-publish"[^>]*>Devam: önizle ve yayınla<\/button>/);
    const out = render({ blocking: { text: "Aşama 1 içinde soru yok.", scorecard: false } });
    expect(out).toMatch(/<button[^>]*id="wizard-to-publish"[^>]*disabled=""[^>]*>Devam: önizle ve yayınla<\/button>/);
    expect(out).toMatch(/id="wizard-to-publish-why"[^>]*>Aşama 1 içinde soru yok\.</);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });

  it("says 'Sorular hazırlanıyor' while the AI writes the first draft after step 1's AI start", () => {
    const out = render({ stages: [], autoDraft: true });
    expect(out).toContain("Sorular hazırlanıyor");
    expect(out).toMatch(/id="wizard-to-publish-why"[^>]*>Sorular hazırlanıyor</);
  });

  it("an empty draft offers the AI (when the position has an ad) and your own question, never writing on its own", () => {
    const out = render({ stages: [] });
    expect(out).not.toContain("Sorular hazırlanıyor");
    expect(out).toMatch(/id="wizard-write-draft"[^>]*>AI soruları yazsın/);
    expect(out).toContain("Kendi sorunu ekle");
    expect(render({ stages: [], canDraft: false })).not.toContain("wizard-write-draft");
  });
});

describe("step 3 'Önizle ve yayınla' (HIRING-UX 5.20)", () => {
  it("shows 'Adım 3 / 3', the candidate's short preview and the link to the full one", () => {
    const out = render({ hash: "#publish" });
    expect(out).toMatch(/<h1[^>]*>Hazır mı\?<\/h1>/);
    expect(out).toContain("Adım 3 / 3");
    expect(out).toContain("1 aşama · 2 soru · yaklaşık 15 dk");
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings\/o1\/assessment\/preview"[^>]*>Adayın ekranını aç/);
  });

  it("starts the team at 'Sadece sen', offers 'Kişi ekle', an optional last day and the rules folded", () => {
    const out = render({ hash: "#publish" });
    expect(out).toMatch(/<input[^>]*type="radio"[^>]*checked=""[^>]*\/>Sadece sen/);
    expect(out).toContain("Kişi ekle");
    expect(out).not.toContain("Ece");
    expect(out).toMatch(/<input type="date"[^>]*id="wizard-deadline"[^>]*min="2026-10-07"/);
    expect(out).toContain("Kurallar");
    expect(out).toContain("kimlik açık · 7 günde dönüş · anket yok");
    // No "at least two reviewers" anywhere (user decision 2026-10-07).
    expect(out).not.toMatch(/en az 2|at least 2/);
  });

  it("has one filled 'Yayınla', waiting with the gate's problem when the draft cannot go live, and 'Geri' to the questions", () => {
    const out = render({ hash: "#publish" });
    expect(out).toMatch(/<button[^>]*id="wizard-publish"[^>]*>Yayınla<\/button>/);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toContain("Geri");
  });

  it("never opens #publish while the questions cannot go live (W3)", () => {
    const out = render({ hash: "#publish", blocking: { text: "Aşama 1 içinde soru yok.", scorecard: false } });
    expect(out).toMatch(/<h1[^>]*>Adaya ne soralım\?<\/h1>/);
  });

  it("speaks English on an English page", () => {
    const out = render({ hash: "#publish" }, "en");
    expect(out).toContain("Ready?");
    expect(out).toContain("Only you");
  });
});
