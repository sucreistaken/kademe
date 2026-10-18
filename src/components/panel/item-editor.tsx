"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, CircleDot, SquareCheck, TextCursorInput, Shuffle, PenLine, BookOpen, Headphones, SpellCheck } from "lucide-react";
import { saveItemAction } from "@/app/(manager)/exam/bank/actions";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { flowJourney } from "@/components/manager/flow-model";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { WITHINS, type Within } from "@/lib/exam/difficulty";
import { CEFR_LEVELS, type Cefr, type ItemType, type Section } from "@/lib/exam/types";
import { itemProblems } from "@/lib/exam/validate";
import { problemSentence } from "./bank-copy";
import { ContentFields } from "./item-editor-fields";
import { CREATE_SECTIONS, CREATE_TYPES, draftToItem, emptyDraft, pickedKindOfDraft, saveInput, type EditorDraft } from "./item-editor-model";

type Step = "type" | "content" | "level";
const CREATE_STEPS: readonly Step[] = ["type", "content", "level"];
const EDIT_STEPS: readonly Step[] = ["content", "level"];

const TYPE_ICON = { SINGLE_CHOICE: CircleDot, MULTI_CHOICE: SquareCheck, TRUE_FALSE_NG: ListChecks, GAP_FILL: TextCursorInput, MATCHING: Shuffle, SHORT_TEXT: PenLine } as const;
const SECTION_ICON = { GRAMMAR: SpellCheck, READING: BookOpen, LISTENING: Headphones } as const;

/**
 * The bank's item editor as a guided flow (the hiring setup wizard's pattern):
 * a new question is "Ne tür bir soru?", "Soruyu yaz", "Seviye ve zorluk"; an
 * edit opens on the question and ends on level and difficulty. Every type's
 * fields are here, checked with the bank's own rules as the teacher types;
 * the footer's button waits with the first problem in words. Saving an
 * approved question keeps it approved and says so before the click.
 */
export function ItemEditor({
  mode,
  itemId,
  initial,
  status,
  canApprove,
  sharedText,
  backHref,
}: {
  mode: "create" | "edit";
  itemId: string | null;
  initial: EditorDraft;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "RETIRED" | null;
  canApprove: boolean;
  sharedText: { title: string; body: string } | null;
  backHref: string;
}) {
  const t = useMT("bankTools");
  const bank = useMT("bank");
  const sec = useMT("sectionName");
  const flow = useMT("flow");
  const router = useRouter();
  const [draft, setDraftState] = useState<EditorDraft>(initial);
  const set = (patch: Partial<EditorDraft> | ((d: EditorDraft) => Partial<EditorDraft>)) => setDraftState((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const problems = useMemo(() => itemProblems(draftToItem(draft)), [draft]);
  const needsText = mode === "create" && draft.section === "LISTENING" && !draft.textBody.trim();
  const firstProblem = problems[0] ? problemSentence((k, v) => t(k as never, v), problems[0]) : needsText ? t("r_LISTENING_WITHOUT_TEXT") : null;
  // An MC cloze or word-bank text names its kind instead of the generic "gap fill".
  const pickedKind = pickedKindOfDraft(draft);
  const typeLabel = pickedKind ? bank(`textKind${pickedKind}`) : bank(`type${draft.type}`);
  const steps = mode === "create" ? CREATE_STEPS : EDIT_STEPS;
  const nav = useFlowStep({ steps, firstInvalid: firstProblem ? "content" : null, mode: "hash" });
  const step = nav.step;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const approved = status === "APPROVED";
  const blockedByRight = approved && !canApprove;

  function chooseType(type: ItemType) {
    // A fresh form for the new type; the section, level and anything typed in the stem stay.
    set((d) => ({ ...emptyDraft(type, d.section, d.level), within: d.within, prompt: d.prompt, textTitle: d.textTitle, textBody: d.textBody }));
  }

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        const res = await saveItemAction(saveInput(draft, itemId));
        if (res.ok) {
          router.push(`/exam/bank/${res.id}?saved=1`);
          return;
        }
        if (res.code === "INVALID") setError(t("fixFirst", { problem: problemSentence((k, v) => t(k as never, v), res.problems[0]) }));
        else if (res.code === "NO_RIGHT") setError(t("approvedNoRight"));
        else if (res.code === "NEEDS_TEXT") setError(t("r_LISTENING_WITHOUT_TEXT"));
        else if (res.code === "SPEAKERS") setError(t("r_LISTENING_SPEAKERS"));
        else setError(t("saveFailed", { reason: res.code }));
      } catch {
        setError(t("saveFailed", { reason: "network" }));
      }
    });
  }

  const typeStep: FlowStep = {
    id: "type",
    title: t("typeTitle"),
    lead: <p>{t("typeLead")}</p>,
    layout: "single",
    primary: { kind: "button", id: "editor-to-content", label: flow("continue"), onClick: () => nav.go("content") },
    body: (
      <div className="space-y-8">
        <div>
          <p id="ed-section-label" className="mb-3 text-[15px] font-semibold text-ink">
            {t("section")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="ed-section"
            look="panel"
            columns={3}
            labelledBy="ed-section-label"
            value={[draft.section]}
            onChange={([v]) => set({ section: v as Section })}
            items={CREATE_SECTIONS.map((s) => ({ value: s, label: sec(s), marker: SECTION_ICON[s] }))}
          />
        </div>
        <div>
          <p id="ed-type-label" className="mb-3 text-[15px] font-semibold text-ink">
            {t("type")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="ed-type"
            look="panel"
            columns={2}
            labelledBy="ed-type-label"
            value={[draft.type]}
            onChange={([v]) => chooseType(v as ItemType)}
            items={CREATE_TYPES.map((ty) => ({ value: ty, label: bank(`type${ty}`), description: t(`hint${ty}`), marker: TYPE_ICON[ty] }))}
          />
        </div>
      </div>
    ),
  };

  const contentStep: FlowStep = {
    id: "content",
    title: mode === "create" ? t("contentTitleNew") : t("contentTitleEdit"),
    lead: (
      <p>
        {mode === "edit" ? `${sec(draft.section)} · ${typeLabel}. ${t("locked")}` : `${sec(draft.section)} · ${typeLabel}. ${t("contentLead")}`}
      </p>
    ),
    layout: "single",
    primary: { kind: "button", id: "editor-to-level", label: flow("continue"), waitReason: firstProblem, onClick: () => nav.go("level") },
    body: <ContentFields draft={draft} set={set} mode={mode} sharedText={sharedText} />,
  };

  const levelStep: FlowStep = {
    id: "level",
    title: t("levelTitle"),
    lead: <p>{t("withinNote")}</p>,
    layout: "single",
    primary: {
      kind: "button",
      id: "editor-save",
      label: mode === "create" ? t("create") : approved ? t("saveApproved") : t("save"),
      busy: saving,
      busyLabel: t("saving"),
      waitReason: blockedByRight ? t("approvedNoRight") : firstProblem,
      onClick: save,
    },
    note: error ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {error}
      </p>
    ) : null,
    body: (
      <div className="space-y-8">
        <div>
          <p id="ed-level-label" className="mb-3 text-[15px] font-semibold text-ink">
            {t("level")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="ed-level"
            look="panel"
            columns={3}
            labelledBy="ed-level-label"
            value={[draft.level]}
            onChange={([v]) => set({ level: v as Cefr })}
            items={CEFR_LEVELS.map((l) => ({ value: l, label: l }))}
          />
        </div>
        <div>
          <p id="ed-within-label" className="mb-3 text-[15px] font-semibold text-ink">
            {t("difficulty")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="ed-within"
            look="panel"
            columns={3}
            labelledBy="ed-within-label"
            value={[draft.within]}
            onChange={([v]) => set({ within: v as Within })}
            items={WITHINS.map((w) => ({ value: w, label: `${draft.level} · ${t(`within${w}`)}`, description: t(`withinHint${w}`) }))}
          />
        </div>
        {approved ? (
          <p role="note" className="rounded-xl border border-line bg-accent-soft p-4 text-[14px] leading-[22px] text-ink">
            {t("approvedWarning")}
          </p>
        ) : mode === "create" ? (
          <p className="text-[14px] text-muted">{t("draftNote")}</p>
        ) : null}
      </div>
    ),
  };

  const current = step === "type" ? typeStep : step === "content" ? contentStep : levelStep;
  const first = steps[0];
  return (
    <GuidedFlow
      kicker={mode === "create" ? t("kickerNew") : t("kickerEdit")}
      step={current}
      journey={flowJourney(steps, step)}
      back={step === first ? null : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty, href: backHref }}
      enter={nav.moved}
    />
  );
}
