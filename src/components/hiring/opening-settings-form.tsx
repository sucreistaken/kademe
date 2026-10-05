"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { canDecide } from "@/solutions/hiring/rules/access";
import { openingRulesProblems, type OpeningRulesInput, type RulesProblem } from "@/solutions/hiring/rules/opening-rules";
import { saveOpeningRulesAction } from "@/app/(manager)/hiring/openings/[id]/settings/actions";

export type SettingsUser = { id: string; name: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

type Notice = { kind: "saved"; renamed: string | null } | { kind: "problem"; problem: RulesProblem } | { kind: "code"; code: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" | "INVALID" } | { kind: "failed" };

const NONE = "none";
/** A whole number as typed, or NaN (which the rules refuse) for anything else. */
const wholeNumber = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

/**
 * HIRING-UX 5.18: one page, team, fair review and candidate contact; no
 * settings maze. The same rules as the server (openingRulesProblems) give
 * "Kaydet" its disabled reason; the server checks them again. A closed
 * opening is shown read-only without a save row (the page offers "Yeniden aç").
 */
export function OpeningSettingsForm({
  openingId,
  initial,
  users,
  today,
  zone,
  canEdit,
  closed,
}: {
  openingId: string;
  initial: OpeningRulesInput;
  users: SettingsUser[];
  /** The organisation's calendar day (orgDay), so the form and the server agree on "past". */
  today: string;
  /** The organisation's time zone name, said next to the deadline. */
  zone: string;
  canEdit: boolean;
  closed: boolean;
}) {
  const t = useMT("hiringSettings");
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [feedbackText, setFeedbackText] = useState(String(initial.feedbackDays));
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const set = <K extends keyof OpeningRulesInput>(key: K, v: OpeningRulesInput[K]) => {
    setNotice(null);
    setValue((s) => ({ ...s, [key]: v }));
  };
  // The saved day comes from the server: a deadline that has already passed blocks only a change.
  const savedDeadline = initial.deadline;
  const problems = openingRulesProblems(value, users, today, savedDeadline);
  const reason = !canEdit ? t("noPermission") : problems.length ? t(`p${problems[0]}`) : null;
  const deciders = users.filter((u) => !u.disabled && canDecide(u.role));
  // A disabled person stays listed while they are still on the panel, so they can be taken off it.
  const panel = users.filter((u) => !u.disabled || initial.memberIds.includes(u.id));
  // A saved decision maker who can no longer decide (disabled, or no longer an owner or manager)
  // stays visible in the select, marked, until someone else is chosen; it cannot be chosen again.
  const stale = (id: string | null) => (id && !deciders.some((u) => u.id === id) ? (users.find((u) => u.id === id) ?? null) : null);
  const selectValue = (id: string | null) => (id && (deciders.some((u) => u.id === id) || stale(id)) ? id : "");
  const staleItem = (id: string | null) => {
    const u = stale(id);
    return u ? (
      <SelectItem key={u.id} value={u.id} disabled>
        {`${u.name} (${u.disabled ? t("inactive") : t(`role${u.role}`)})`}
      </SelectItem>
    ) : null;
  };
  const activeReviewers = value.memberIds.filter((id) => users.some((u) => u.id === id && !u.disabled)).length;
  const locked = !canEdit || pending;

  const save = () =>
    start(async () => {
      try {
        const res = await saveOpeningRulesAction(openingId, value);
        if (res.ok) {
          // A name another opening already has was numbered on the server: show what was stored.
          const renamed = res.name !== value.name.trim() ? res.name : null;
          if (renamed) setValue((s) => ({ ...s, name: renamed }));
          setNotice({ kind: "saved", renamed });
          router.refresh();
        } else if ("problems" in res) setNotice(res.problems[0] ? { kind: "problem", problem: res.problems[0] } : { kind: "failed" });
        else setNotice({ kind: "code", code: res.code });
      } catch {
        setNotice({ kind: "failed" });
      }
    });

  const noticeText =
    notice?.kind === "saved"
      ? notice.renamed
        ? t("savedRenamed", { name: notice.renamed })
        : t("saved")
      : notice?.kind === "problem"
        ? t(`p${notice.problem}`)
        : notice?.kind === "code"
          ? t(`err${notice.code}`)
          : notice?.kind === "failed"
            ? t("saveFailed")
            : "";

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("teamTitle")}</h2>
        <div className="max-w-[480px] space-y-2">
          <Label htmlFor="opening-name">{t("name")}</Label>
          <Input id="opening-name" value={value.name} maxLength={200} disabled={locked} onChange={(e) => set("name", e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[14px] font-medium text-ink">{t("members")}</legend>
          <p className="text-[13px] text-muted">{t("membersHint")}</p>
          <ul className="grid gap-x-6 gap-y-2 pt-1 md:grid-cols-2">
            {panel.map((u) => {
              const checked = value.memberIds.includes(u.id);
              return (
                <li key={u.id} className="flex min-h-8 items-center gap-3">
                  <Checkbox
                    id={`member-${u.id}`}
                    checked={checked}
                    // A disabled person can be taken off the panel but not put back on it.
                    disabled={locked || (u.disabled && !checked)}
                    onCheckedChange={(c) => set("memberIds", c === true ? [...value.memberIds, u.id] : value.memberIds.filter((id) => id !== u.id))}
                  />
                  <Label htmlFor={`member-${u.id}`} className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px] font-normal", u.disabled ? "text-muted" : "text-ink")}>
                    <span className="truncate">{u.name}</span>{" "}
                    <span className="text-[12px] text-muted">{u.disabled ? t("inactive") : t(`role${u.role}`)}</span>
                  </Label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <div className="space-y-2">
          <div className="grid gap-field md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="decision-maker">{t("decisionMaker")}</Label>
              <Select value={selectValue(value.decisionMakerId)} disabled={locked} onValueChange={(v) => set("decisionMakerId", v)}>
                <SelectTrigger id="decision-maker" className="w-full">
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {staleItem(value.decisionMakerId)}
                  {deciders.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-decision-maker">{t("backup")}</Label>
              <Select
                value={value.backupDecisionMakerId ? selectValue(value.backupDecisionMakerId) : NONE}
                disabled={locked}
                onValueChange={(v) => set("backupDecisionMakerId", v === NONE ? null : v)}
              >
                <SelectTrigger id="backup-decision-maker" className="w-full">
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("noBackup")}</SelectItem>
                  {staleItem(value.backupDecisionMakerId)}
                  {deciders.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-evaluations">{t("minEvaluations")}</Label>
              <Select value={String(value.minEvaluations)} disabled={locked} onValueChange={(v) => set("minEvaluations", Number(v))}>
                <SelectTrigger id="min-evaluations" className="tnum w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)} className="tnum">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {value.minEvaluations > activeReviewers ? (
            <p className="tnum text-[13px] text-ink">{t("minEvaluationsShort", { count: activeReviewers, min: value.minEvaluations })}</p>
          ) : null}
          <p className="text-[13px] text-muted">{t("decisionMakerHint")}</p>
          <p className="text-[13px] text-muted">{t("minEvaluationsOverride")}</p>
        </div>
      </Card>

      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("fairTitle")}</h2>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Switch id="blind-mode" checked={value.blindMode} disabled={locked} onCheckedChange={(v) => set("blindMode", v)} aria-describedby="blind-mode-hint" />
            <Label htmlFor="blind-mode" className="text-[14px] font-normal text-ink">
              {t("blindMode")}
            </Label>
          </div>
          <p id="blind-mode-hint" className="pl-12 text-[13px] text-muted">
            {t("blindModeHint")}
          </p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-3 text-[14px] text-ink">
            <Lock className="size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
            {t("independence")}
          </p>
          <p className="pl-7 text-[13px] text-muted">{t("independenceLocked")}</p>
        </div>
      </Card>

      <Card className="space-y-field p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("candidateTitle")}</h2>
        <div className="grid gap-field md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="deadline">{t("deadline")}</Label>
            <Input
              id="deadline"
              type="date"
              className="tnum"
              // The earliest day applies only to a new value; a passed deadline left as it is stays valid.
              min={value.deadline === savedDeadline ? undefined : today}
              value={value.deadline ?? ""}
              disabled={locked}
              aria-describedby="deadline-hint"
              onChange={(e) => set("deadline", e.target.value || null)}
            />
            <p id="deadline-hint" className="text-[13px] text-muted">
              {t("deadlineHint", { zone })}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-days">{t("feedbackDays")}</Label>
            <Input
              id="feedback-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              className="tnum"
              value={feedbackText}
              disabled={locked}
              aria-describedby="feedback-days-hint"
              onChange={(e) => {
                setFeedbackText(e.target.value);
                set("feedbackDays", wholeNumber(e.target.value));
              }}
            />
            <p id="feedback-days-hint" className="tnum text-[13px] text-muted">
              {t("feedbackHint", { days: Number.isNaN(value.feedbackDays) ? "-" : value.feedbackDays })}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">{t("contactEmail")}</Label>
            <Input
              id="contact-email"
              type="email"
              autoComplete="off"
              maxLength={200}
              value={value.candidateContactEmail}
              disabled={locked}
              onChange={(e) => set("candidateContactEmail", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Switch
              id="finish-survey"
              checked={value.finishSurveyEnabled ?? true}
              disabled={locked}
              onCheckedChange={(v) => set("finishSurveyEnabled", v)}
              aria-describedby="finish-survey-hint"
            />
            <Label htmlFor="finish-survey" className="text-[14px] font-normal text-ink">
              {t("finishSurvey")}
            </Label>
          </div>
          <p id="finish-survey-hint" className="pl-12 text-[13px] text-muted">
            {t("finishSurveyHint")}
          </p>
        </div>
      </Card>

      {closed ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            id="save-rules"
            variant="primary"
            disabled={pending || reason !== null}
            disabledReason={reason ?? undefined}
            aria-busy={pending || undefined}
            onClick={save}
          >
            {pending ? t("saving") : t("save")}
          </Button>
          {reason ? <DisabledReason id="save-rules-why">{reason}</DisabledReason> : null}
          <p role="status" className={cn("text-[13px]", notice && notice.kind !== "saved" ? "font-medium text-ink" : "text-muted")}>
            {noticeText}
          </p>
        </div>
      )}
    </div>
  );
}
