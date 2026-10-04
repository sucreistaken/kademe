"use client";

import { useState, useTransition } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { ANCHOR_LEVELS, hasText, REQUIRED_ANCHOR_LEVELS } from "@/lib/library/anchors";
import { saveAnchorsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions";
import type { ScorecardCode } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/result";
import { refusalText } from "./refusal-copy";

const empty = (): I18nText => ({ tr: "", en: "" });

/**
 * HIRING-UX 5.7: a competency's anchors in a Sheet, without leaving the
 * scorecard. On a draft they are the library's anchors and saving changes the
 * library (the description says so); a published card's anchors are its copy
 * and only shown. Levels 1, 3 and 5 are required, 2 and 4 optional. After a
 * save the Sheet hands the stored anchors back (onSaved), so the page shows
 * what the server kept (Task 5 rule), and closes.
 */
export function AnchorSheet({
  openingId,
  competency,
  levels,
  editable,
  reason,
  note,
  returnFocusId,
  onClose,
  onSaved,
}: {
  openingId: string;
  competency: { id: string; name: string; anchors: Partial<Record<number, I18nText>> };
  levels: Array<{ value: number; label: string }>;
  /** False shows the anchors read-only, with `note` saying why. */
  editable: boolean;
  /** Why saving is not possible although the anchors are editable (the role cannot change the library). */
  reason: string | null;
  note: string | null;
  /** The row button focus returns to on close, also when the Sheet was opened from a link (?anchors=). */
  returnFocusId: string;
  onClose: () => void;
  onSaved: (anchors: Record<number, I18nText>) => void;
}) {
  const t = useMT("hiringScorecard");
  const [anchors, setAnchors] = useState<Partial<Record<number, I18nText>>>(competency.anchors);
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<ScorecardCode | "NETWORK" | null>(null);
  const missing = REQUIRED_ANCHOR_LEVELS.filter((level) => !hasText(anchors[level]));
  const why = reason ?? (missing.length ? t("sheetRequired", { level: missing[0] }) : null);
  const levelName = (value: number) => levels.find((l) => l.value === value)?.label || String(value);

  function save() {
    setRefusal(null);
    start(async () => {
      try {
        const payload = Object.fromEntries(ANCHOR_LEVELS.map((l) => [String(l), anchors[l] ?? empty()]));
        const result = await saveAnchorsAction(openingId, competency.id, payload);
        if (result.ok) {
          onSaved(result.anchors);
          onClose();
        } else {
          setRefusal(result.code);
        }
      } catch {
        setRefusal("NETWORK");
      }
    });
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(returnFocusId)?.focus();
        }}
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-[560px]">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-[16px] leading-6 font-semibold text-ink">{t("sheetTitle", { competency: competency.name })}</SheetTitle>
          <SheetDescription className="text-[13px] leading-5 text-muted">{editable ? t("sheetDescription") : note}</SheetDescription>
        </SheetHeader>
        <div className="space-y-field px-6">
          {ANCHOR_LEVELS.map((level) => {
            const required = (REQUIRED_ANCHOR_LEVELS as readonly number[]).includes(level);
            return (
              <I18nPair
                key={level}
                multiline
                disabled={!editable || pending}
                label={`${level} · ${levelName(level)}${required ? "" : ` (${t("sheetOptional")})`}`}
                value={anchors[level] ?? empty()}
                onChange={(next) => setAnchors((current) => ({ ...current, [level]: next }))}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 pt-6 pb-8">
          {editable ? (
            <>
              <Button id="anchors-save" variant="primary" onClick={save} disabled={pending || why !== null} disabledReason={why ?? undefined} aria-busy={pending || undefined}>
                {pending ? t("saving") : t("sheetSave")}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={pending} disabledReason={pending ? t("saving") : undefined}>
                {t("sheetClose")}
              </Button>
              {why ? <DisabledReason id="anchors-save-why">{why}</DisabledReason> : null}
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {t("sheetClose")}
            </Button>
          )}
          <p role="status" className="w-full text-[13px] text-destructive">
            {refusal ? refusalText({ code: refusal }, t) : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
