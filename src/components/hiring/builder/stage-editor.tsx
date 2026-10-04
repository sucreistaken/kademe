"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { ContentStage } from "@/solutions/hiring/rules/content";
import { ColumnHeading, FieldError, invalidProps, ItemActions, type EditorBinding } from "./fields";

const LANGS = ["tr", "en"] as const;
export const VAULT_SECTION = "space-y-field rounded-xl bg-vault p-card text-vault-text [&_:focus-visible]:outline-vault-text";
export const VAULT_FIELD = "border-vault-line bg-vault-box text-vault-text placeholder:text-vault-label";

/**
 * A stage: its candidate text in the middle column, its purpose in the team
 * column (HIRING-UX 5.5). Every field saves while typing (debounced) and on
 * leaving it; the text stays here whatever the server answers.
 */
export function StageEditor({
  stage,
  index,
  count,
  binding,
  autoFocus,
  onMove,
  onDelete,
}: {
  stage: ContentStage;
  index: number;
  count: number;
  binding: EditorBinding;
  autoFocus: boolean;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useMT("hiringBuilder");
  const { editable, onEdit, onFlush, errorFor } = binding;
  const [name, setName] = useState<I18nText>(stage.name);
  const [description, setDescription] = useState<I18nText>(stage.description);
  const [minutes, setMinutes] = useState(String(Math.round(stage.durationSeconds / 60)));
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState(stage.internalPurpose ?? "");
  const minutesMessage = minutesError ?? errorFor("durationSeconds");

  return (
    <>
      <section className="space-y-field rounded-xl border border-line bg-surface p-card" aria-label={t("candidateSide")}>
        <ColumnHeading>{t("candidateSide")}</ColumnHeading>
        {LANGS.map((lang) => {
          const id = `stage-name-${lang}`;
          const error = errorFor(`name.${lang}`) ?? errorFor("name");
          return (
            <div key={lang} className="space-y-2">
              <Label htmlFor={id}>{`${t("stageName")} (${lang.toUpperCase()})`}</Label>
              <Input
                id={id}
                value={name[lang]}
                readOnly={!editable}
                autoFocus={autoFocus && lang === "tr"}
                placeholder={t("untitledStage", { n: index + 1 })}
                onChange={(e) => {
                  const next = { ...name, [lang]: e.target.value };
                  setName(next);
                  onEdit("name", next);
                }}
                onBlur={onFlush}
                {...invalidProps(id, error)}
              />
              <FieldError id={id} error={error} />
            </div>
          );
        })}
        {LANGS.map((lang) => {
          const id = `stage-desc-${lang}`;
          const error = errorFor(`description.${lang}`) ?? errorFor("description");
          return (
            <div key={lang} className="space-y-2">
              <Label htmlFor={id}>{`${t("stageDescription")} (${lang.toUpperCase()})`}</Label>
              <Textarea
                id={id}
                value={description[lang]}
                readOnly={!editable}
                onChange={(e) => {
                  const next = { ...description, [lang]: e.target.value };
                  setDescription(next);
                  onEdit("description", next);
                }}
                onBlur={onFlush}
                {...invalidProps(id, error)}
              />
              <FieldError id={id} error={error} />
            </div>
          );
        })}
        <div className="max-w-[200px] space-y-2">
          <Label htmlFor="stage-minutes">{t("stageMinutes")}</Label>
          <Input
            id="stage-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            className="tnum"
            value={minutes}
            readOnly={!editable}
            onChange={(e) => {
              setMinutes(e.target.value);
              if (!/^\d+$/.test(e.target.value)) {
                setMinutesError(t("errWhole"));
                return;
              }
              setMinutesError(null);
              onEdit("durationSeconds", Number(e.target.value) * 60);
            }}
            onBlur={onFlush}
            {...invalidProps("stage-minutes", minutesMessage)}
          />
          <FieldError id="stage-minutes" error={minutesMessage} />
        </div>
        {editable ? <ItemActions idPrefix="stage" index={index} count={count} onMove={onMove} onDelete={onDelete} deleteLabel={t("deleteStage")} /> : null}
      </section>
      <section className={VAULT_SECTION} aria-label={t("teamSide")}>
        <ColumnHeading tone="vault">{t("teamSide")}</ColumnHeading>
        <div className="space-y-2">
          <Label htmlFor="stage-purpose" className="text-vault-label">
            {t("stagePurpose")}
          </Label>
          <Textarea
            id="stage-purpose"
            className={VAULT_FIELD}
            value={purpose}
            readOnly={!editable}
            onChange={(e) => {
              setPurpose(e.target.value);
              onEdit("internalPurpose", e.target.value.trim() || null);
            }}
            onBlur={onFlush}
            {...invalidProps("stage-purpose", errorFor("internalPurpose"))}
          />
          <FieldError id="stage-purpose" error={errorFor("internalPurpose")} tone="vault" />
        </div>
      </section>
    </>
  );
}
