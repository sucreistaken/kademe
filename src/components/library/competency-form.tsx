"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { I18nPair } from "@/components/manager/i18n-pair";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import {
  ANCHOR_LEVELS,
  anchorHint,
  COMPETENCY_NAME_MAX,
  hasText,
  MAX_TAGS_PER_SIDE,
  REQUIRED_ANCHOR_LEVELS,
  TAG_LABEL_MAX,
} from "@/lib/library/anchors";
import { formTags, type FormTag } from "@/lib/library/form-tags";
import { saveCompetencyAction } from "@/app/(manager)/library/actions";

export type { FormTag };
export type CompetencyFormValue = {
  name: I18nText;
  description: I18nText;
  anchors: Record<number, I18nText>;
  tags: FormTag[];
};

const empty = (): I18nText => ({ tr: "", en: "" });

/**
 * HIRING-UX 5.10. Saving is explicit ("Kaydet", no autosave): the library is an
 * organisation asset, so a change should be deliberate. Levels 1, 3 and 5 are
 * required; the trait-word hint is advice and never blocks.
 */
export function CompetencyForm({
  id,
  initial,
  levels,
  canWrite,
  archived = false,
  seededUnreviewed,
  liveCount,
  locale,
}: {
  id: string;
  initial: CompetencyFormValue;
  levels: Array<{ value: number; label: I18nText }>;
  canWrite: boolean;
  /** Read-only with no save row: the page says it is archived and offers the restore. */
  archived?: boolean;
  seededUnreviewed: boolean;
  liveCount: number;
  locale: Locale;
}) {
  const t = useMT("libCompetencies");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [markReviewed, setMarkReviewed] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "error" | "archived" | null>(null);

  const missing = REQUIRED_ANCHOR_LEVELS.filter((level) => !hasText(value.anchors[level]));
  const reason = !canWrite
    ? t("noPermission")
    : !hasText(value.name)
      ? t("nameRequired")
      : missing.length
        ? t("anchorRequired", { level: missing[0] })
        : null;
  const levelName = (v: number) => pickText(levels.find((l) => l.value === v)?.label, locale) || String(v);
  const side = (polarity: FormTag["polarity"]) => value.tags.filter((tag) => tag.polarity === polarity);
  const setTag = (key: string, label: I18nText) =>
    setValue((v) => ({ ...v, tags: v.tags.map((tag) => (tag.key === key ? { ...tag, label } : tag)) }));
  const removeTag = (key: string) => setValue((v) => ({ ...v, tags: v.tags.filter((tag) => tag.key !== key) }));
  const addTag = (polarity: FormTag["polarity"]) =>
    setValue((v) => ({ ...v, tags: [...v.tags, { key: crypto.randomUUID(), id: null, polarity, label: empty() }] }));

  function save() {
    setResult(null);
    start(async () => {
      const res = await saveCompetencyAction(id, {
        name: value.name,
        description: value.description,
        anchors: Object.fromEntries(ANCHOR_LEVELS.map((l) => [String(l), value.anchors[l] ?? empty()])),
        tags: value.tags.map(({ id: tagId, polarity, label }) => ({ id: tagId, polarity, label })),
        markReviewed,
      });
      if (res.ok) {
        // Adopt the stored ids: a tag added in this save is updated, not re-created, by the next one.
        setValue((v) => ({ ...v, tags: formTags(res.tags) }));
        setResult("saved");
        router.refresh();
      } else {
        setResult(res.code === "ARCHIVED" ? "archived" : "error");
      }
    });
  }

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <I18nPair label={t("name")} value={value.name} maxLength={COMPETENCY_NAME_MAX} disabled={!canWrite} onChange={(name) => setValue((v) => ({ ...v, name }))} />
        <I18nPair
          label={t("description")}
          multiline
          disabled={!canWrite}
          hint={<p className="text-[13px] text-muted">{t("descriptionHint")}</p>}
          value={value.description}
          onChange={(description) => setValue((v) => ({ ...v, description }))}
        />
      </Card>

      <Card className="space-y-field p-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("anchorsTitle")}</h2>
            <p className="text-[13px] text-muted">{t("anchorsSub")}</p>
          </div>
          {/* Task 7: the AI anchor assist goes here. */}
        </div>
        {ANCHOR_LEVELS.map((level) => {
          const body = value.anchors[level] ?? empty();
          const hint = (body.tr.trim() ? anchorHint(body.tr, "tr") : null) ?? (body.en.trim() ? anchorHint(body.en, "en") : null);
          const required = (REQUIRED_ANCHOR_LEVELS as readonly number[]).includes(level);
          return (
            <I18nPair
              key={level}
              multiline
              disabled={!canWrite}
              label={`${level} · ${levelName(level)}${required ? "" : ` (${t("optional")})`}`}
              value={body}
              onChange={(next) => setValue((v) => ({ ...v, anchors: { ...v.anchors, [level]: next } }))}
              hint={hint ? <p className="text-[13px] text-muted">{t(hint === "ADJECTIVE" ? "hintAdjective" : "hintShort")}</p> : null}
            />
          );
        })}
      </Card>

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("tagsTitle")}</h2>
        <p className="text-[13px] text-muted">{t("tagsSub")}</p>
        {/* One side per row: the form column is about 620px, too narrow for two sides of TR + EN inputs. */}
        <div className="mt-4 grid gap-6">
          {(["POSITIVE", "NEGATIVE"] as const).map((polarity) => (
            <div key={polarity} className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">{t(polarity === "POSITIVE" ? "tagsPositive" : "tagsNegative")}</h3>
              {side(polarity).map((tag) => (
                <div key={tag.key} className="flex items-start gap-2">
                  <Input aria-label={`${t("tag")} TR`} placeholder="TR" maxLength={TAG_LABEL_MAX} disabled={!canWrite} value={tag.label.tr} onChange={(e) => setTag(tag.key, { ...tag.label, tr: e.target.value })} />
                  <Input aria-label={`${t("tag")} EN`} placeholder="EN" maxLength={TAG_LABEL_MAX} disabled={!canWrite} value={tag.label.en} onChange={(e) => setTag(tag.key, { ...tag.label, en: e.target.value })} />
                  {canWrite ? (
                    <Button variant="ghost" size="sm" onClick={() => removeTag(tag.key)}>
                      {t("removeTag")}
                    </Button>
                  ) : null}
                </div>
              ))}
              {!canWrite ? null : side(polarity).length >= MAX_TAGS_PER_SIDE ? (
                <DisabledReason>{t("tagLimit", { max: MAX_TAGS_PER_SIDE })}</DisabledReason>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => addTag(polarity)}>
                  {t("addTag")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {liveCount > 0 && !archived ? <p className="text-[13px] text-muted">{t("liveNote", { count: liveCount })}</p> : null}
      {archived ? null : (
        <div className="flex flex-wrap items-center gap-4">
          {seededUnreviewed && canWrite ? (
            <label className="flex items-center gap-2 text-[14px] text-ink">
              <Checkbox checked={markReviewed} onCheckedChange={(c) => setMarkReviewed(c === true)} />
              {t("markReviewed")}
            </label>
          ) : null}
          <Button id="competency-save" variant="primary" onClick={save} disabled={pending || reason !== null} disabledReason={reason ?? undefined}>
            {pending ? t("saving") : t("save")}
          </Button>
          {reason ? <DisabledReason id="competency-save-why">{reason}</DisabledReason> : null}
          {result === "saved" ? <span role="status" className="text-[13px] text-muted">{t("saved")}</span> : null}
          {result === "error" ? <span role="status" className="text-[13px] text-destructive">{t("saveFailed")}</span> : null}
          {result === "archived" ? <span role="status" className="text-[13px] text-destructive">{t("archivedNoSave")}</span> : null}
        </div>
      )}
    </div>
  );
}
