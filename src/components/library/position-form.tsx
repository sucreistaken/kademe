"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import {
  POSITION_JOB_AD_MAX,
  POSITION_LANGUAGE_MAX,
  POSITION_LANGUAGES_MAX,
  POSITION_NAME_MAX,
  POSITION_PROFILE_MAX,
  POSITION_SHORT_MAX,
  POSITION_SKILL_MAX,
  POSITION_SKILLS_MAX,
  POSITION_TEAM_MAX,
  positionFormValue,
  splitList,
  validWeight,
  type PositionFormValue,
} from "@/lib/library/positions";
import { savePositionAction } from "@/app/(manager)/library/actions";

export type { PositionFormValue };

const listsFit = (skills: string[], languages: string[]) =>
  skills.length <= POSITION_SKILLS_MAX &&
  languages.length <= POSITION_LANGUAGES_MAX &&
  skills.every((s) => s.length <= POSITION_SKILL_MAX) &&
  languages.every((l) => l.length <= POSITION_LANGUAGE_MAX);

/**
 * HIRING-UX 5.9: definition, job ad and the competency profile. Saving is
 * explicit ("Kaydet", no autosave), like the rest of the library.
 */
export function PositionForm({
  id,
  initial,
  options,
  levels,
  canWrite,
  archived = false,
  primary,
  locale,
}: {
  id: string;
  initial: PositionFormValue;
  options: Array<{ id: string; name: I18nText }>;
  levels: Array<{ value: number; label: I18nText }>;
  canWrite: boolean;
  /** Read-only with no save row: the page says it is archived and offers the restore. */
  archived?: boolean;
  /** False when a solution's position action is the screen's filled button. */
  primary: boolean;
  locale: Locale;
}) {
  const t = useMT("libPositions");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"saved" | "saveFailed" | "archivedNoSave" | "competencyRefused" | null>(null);
  // An edit clears the last save's message: "Kaydedildi." must not stand next to unsaved changes.
  const edit = (next: (s: PositionFormValue) => PositionFormValue) => {
    setResult(null);
    setValue(next);
  };
  const set = <K extends keyof PositionFormValue>(key: K, v: PositionFormValue[K]) => edit((s) => ({ ...s, [key]: v }));
  const setRow = (index: number, patch: Partial<PositionFormValue["profile"][number]>) =>
    edit((s) => ({ ...s, profile: s.profile.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  const used = new Set(value.profile.map((p) => p.competencyId));
  // Archived competencies are in `options` only to name rows the profile already had.
  const free = options.filter((o) => !used.has(o.id) && !initial.profile.some((p) => p.archived && p.competencyId === o.id));
  const nameOf = (cid: string) => pickText(options.find((o) => o.id === cid)?.name, locale);
  const skills = splitList(value.skills);
  const languages = splitList(value.languages);
  const reason = !canWrite
    ? t("noPermission")
    : !value.name.trim()
      ? t("nameRequired")
      : value.profile.some((p) => !validWeight(p.weight))
        ? t("weightInvalid")
        : !listsFit(skills, languages)
          ? t("listInvalid", {
              skills: POSITION_SKILLS_MAX,
              skillMax: POSITION_SKILL_MAX,
              languages: POSITION_LANGUAGES_MAX,
              languageMax: POSITION_LANGUAGE_MAX,
            })
          : null;

  function save() {
    setResult(null);
    start(async () => {
      const res = await savePositionAction(id, {
        name: value.name,
        team: value.team,
        shortDescription: value.shortDescription,
        jobDescription: value.jobDescription,
        skills,
        languages,
        profile: value.profile.map((p) => ({
          competencyId: p.competencyId,
          weight: Number(p.weight),
          expectedLevel: p.expectedLevel === "none" ? null : Number(p.expectedLevel),
        })),
      });
      if (res.ok) {
        // Adopt what was stored (trimmed, deduplicated), keeping which rows are archived.
        const archivedIds = new Set(value.profile.filter((p) => p.archived).map((p) => p.competencyId));
        setValue(
          positionFormValue({
            ...res.position,
            profile: res.position.profile.map((p) => ({ ...p, archived: archivedIds.has(p.competencyId) })),
          }),
        );
        setResult("saved");
        router.refresh();
      } else {
        setResult(res.code === "ARCHIVED" ? "archivedNoSave" : res.code === "COMPETENCY" ? "competencyRefused" : "saveFailed");
      }
    });
  }

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <div className="grid gap-field md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pos-name">{t("name")}</Label>
            <Input id="pos-name" maxLength={POSITION_NAME_MAX} value={value.name} disabled={!canWrite} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-team">{t("team")}</Label>
            <Input id="pos-team" maxLength={POSITION_TEAM_MAX} value={value.team} disabled={!canWrite} onChange={(e) => set("team", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pos-short">{t("shortDescription")}</Label>
          <Textarea
            id="pos-short"
            maxLength={POSITION_SHORT_MAX}
            value={value.shortDescription}
            disabled={!canWrite}
            onChange={(e) => set("shortDescription", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pos-ad">{t("jobDescription")}</Label>
          <Textarea
            id="pos-ad"
            rows={8}
            maxLength={POSITION_JOB_AD_MAX}
            value={value.jobDescription}
            disabled={!canWrite}
            onChange={(e) => set("jobDescription", e.target.value)}
          />
          <p className="text-[13px] text-muted">{t("jobDescriptionHint")}</p>
        </div>
        <div className="grid gap-field md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pos-skills">{t("skills")}</Label>
            <Input id="pos-skills" value={value.skills} disabled={!canWrite} onChange={(e) => set("skills", e.target.value)} />
            <p className="text-[13px] text-muted">{t("commaHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-langs">{t("languages")}</Label>
            <Input id="pos-langs" value={value.languages} disabled={!canWrite} onChange={(e) => set("languages", e.target.value)} />
            <p className="text-[13px] text-muted">{t("commaHint")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("profileTitle")}</h2>
        <p className="text-[13px] text-muted">{t("profileSub")}</p>
        {value.profile.length === 0 ? <p className="mt-4 text-[13px] text-muted">{t("profileEmpty")}</p> : null}
        <div className="mt-4 space-y-3">
          {value.profile.map((row, index) => (
            <div key={row.competencyId} className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_88px_200px_auto]">
              <span className="min-w-0 text-[14px] text-ink">
                {nameOf(row.competencyId)}
                {row.archived ? <span className="ml-2 text-[12px] text-muted">({t("archivedCompetency")})</span> : null}
              </span>
              <Input
                aria-label={`${t("weight")}: ${nameOf(row.competencyId)}`}
                aria-invalid={!validWeight(row.weight) || undefined}
                inputMode="numeric"
                maxLength={3}
                className="tnum"
                value={row.weight}
                disabled={!canWrite}
                onChange={(e) => setRow(index, { weight: e.target.value })}
              />
              <Select value={row.expectedLevel} disabled={!canWrite} onValueChange={(v) => setRow(index, { expectedLevel: v })}>
                <SelectTrigger aria-label={`${t("expectedLevel")}: ${nameOf(row.competencyId)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noExpectedLevel")}</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.value} value={String(l.value)}>
                      {l.value} · {pickText(l.label, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canWrite ? (
                <Button variant="ghost" size="sm" onClick={() => set("profile", value.profile.filter((_, i) => i !== index))}>
                  {t("removeCompetency")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        {!canWrite ? null : value.profile.length >= POSITION_PROFILE_MAX ? (
          <DisabledReason className="mt-4">{t("profileLimit", { max: POSITION_PROFILE_MAX })}</DisabledReason>
        ) : free.length ? (
          <div className="mt-4 max-w-[360px]">
            <Select
              value=""
              onValueChange={(cid) => set("profile", [...value.profile, { competencyId: cid, weight: "50", expectedLevel: "none", archived: false }])}
            >
              <SelectTrigger aria-label={t("addCompetency")}>
                <SelectValue placeholder={t("addCompetency")} />
              </SelectTrigger>
              <SelectContent>
                {free.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {pickText(o.name, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-muted">{t("noMoreCompetencies")}</p>
        )}
      </Card>

      {archived ? null : (
        <div className="flex flex-wrap items-center gap-4">
          <Button
            id="position-save"
            variant={primary ? "primary" : "secondary"}
            onClick={save}
            disabled={pending || reason !== null}
            disabledReason={reason ?? undefined}
          >
            {pending ? t("saving") : t("save")}
          </Button>
          {reason ? <DisabledReason id="position-save-why">{reason}</DisabledReason> : null}
          {result === "saved" ? (
            <span role="status" className="text-[13px] text-muted">
              {t("saved")}
            </span>
          ) : result ? (
            <span role="status" className="text-[13px] text-destructive">
              {t(result)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
