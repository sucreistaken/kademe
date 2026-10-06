"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { inviteStudent, type InviteState } from "@/app/(manager)/exam/students/new/actions";
import { bankCoverage, type BankCount, type BlueprintConfig } from "@/lib/exam/blueprint";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";

/**
 * One choice in the exam picker. `value` is an exam-choice value
 * (src/lib/exam/exam-choice). A template that is not `published` yet becomes
 * an exam on this invite, so it needs the publish coverage (every level or
 * every claim), not only the chosen claim's.
 */
export type ExamOption = {
  value: string;
  group: "template" | "own";
  name: string;
  summary: string | null;
  mode: "PLACEMENT" | "LEVEL_VERIFICATION";
  published: boolean;
  config: BlueprintConfig;
  minutes: number;
  sections: number;
};

const field = "mt-1.5 h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[14.5px] text-ink";

/**
 * The invite form. Early validation: the bank's coverage for the chosen exam
 * and claim is checked while the teacher fills the form, so the button says
 * why it is off before anything is sent.
 */
export function InviteForm({ options, counts }: { options: ExamOption[]; counts: BankCount[] }) {
  const t = useMT("invite");
  const sec = useMT("sectionName");
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteStudent, null);
  const [choice, setChoice] = useState(options[0]?.value ?? "");
  const [claimed, setClaimed] = useState<Cefr | "">("");
  const [copied, setCopied] = useState(false);
  const bp = options.find((o) => o.value === choice);
  const coverage = useMemo(
    () => (bp ? bankCoverage(counts, bp.config, bp.mode, bp.mode === "LEVEL_VERIFICATION" && bp.published ? claimed || null : null) : null),
    [bp, counts, claimed],
  );
  const missing = coverage?.rows.find((r) => !r.ok);
  const groups = [
    { key: "template", label: t("groupTemplates"), items: options.filter((o) => o.group === "template") },
    { key: "own", label: t("groupOwn"), items: options.filter((o) => o.group === "own") },
  ].filter((g) => g.items.length > 0);
  const needsClaim = bp?.mode === "LEVEL_VERIFICATION" && !claimed;

  if (state?.ok) {
    return (
      <div className="mt-8 rounded-[14px] border border-line bg-surface p-6">
        <h2 className="text-[18px] font-bold text-ink">{t("doneTitle")}</h2>
        <p className="mt-1 text-[14px] text-muted">{state.name}</p>
        <p className="mt-3 text-[13.5px] text-ink-2">{t("doneBody")}</p>
        <input readOnly value={state.url} className={cn(field, "mt-3 font-mono text-[12.5px]")} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(state.url).catch(() => undefined);
            setCopied(true);
          }}
          className="mt-4 h-11 w-full rounded-[10px] bg-accent text-[14.5px] font-semibold text-white hover:bg-accent-hover"
        >
          {copied ? t("copied") : t("copy")}
        </button>
        <div className="mt-4 flex justify-between text-[13.5px]">
          <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
            {t("another")}
          </button>
          <Link href="/exam/students" className="underline underline-offset-2">
            {t("toList")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <label className="text-[13.5px] font-medium text-ink">
        {t("name")}
        <input name="fullName" required minLength={2} className={field} />
      </label>
      <label className="text-[13.5px] font-medium text-ink">
        {t("email")}
        <input name="email" type="email" required className={field} />
      </label>
      <label className="text-[13.5px] font-medium text-ink">
        {t("exam")}
        <select name="exam" value={choice} onChange={(e) => setChoice(e.target.value)} className={field}>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.items.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {bp?.summary ? <span className="mt-1.5 block text-[12.5px] font-normal text-ink-2">{bp.summary}</span> : null}
        {bp ? (
          <span className="mt-1 block text-[12.5px] font-normal text-muted">
            {t("examMeta", { minutes: bp.minutes, sections: bp.sections, preset: t(`preset${bp.config.proctoring.preset}`) })}
          </span>
        ) : null}
      </label>
      {bp?.mode === "LEVEL_VERIFICATION" ? (
        <fieldset>
          <legend className="text-[13.5px] font-medium text-ink">{t("claimed")}</legend>
          <div className="mt-1.5 flex gap-1.5">
            {CEFR_LEVELS.map((l) => (
              <label
                key={l}
                className={cn(
                  "tnum flex h-10 w-14 cursor-pointer items-center justify-center rounded-[8px] border text-[14px] font-semibold",
                  claimed === l ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong",
                )}
              >
                <input type="radio" name="claimed" value={l} className="sr-only" checked={claimed === l} onChange={() => setClaimed(l)} />
                {l}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">{t("claimedHint")}</p>
        </fieldset>
      ) : null}
      <label className="text-[13.5px] font-medium text-ink">
        {t("language")}
        <select name="locale" className={field} defaultValue="tr">
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </label>

      <div>
        <button
          type="submit"
          disabled={pending || !!missing || needsClaim}
          className="h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
        {needsClaim ? <p className="mt-2 text-[13px] text-muted">{t("errCLAIM_REQUIRED")}</p> : null}
        {missing && !needsClaim ? (
          <p className="mt-2 text-[13px] text-muted">
            {t(bp?.published ? "coverageBlocked" : "templateCoverageBlocked", {
              section: sec(missing.section),
              level: missing.level,
              available: missing.available,
              needed: missing.needed,
            })}{" "}
            <Link href="/exam/bank" className="text-ink underline underline-offset-2">
              {t("toBank")}
            </Link>
          </p>
        ) : null}
        {state && !state.ok ? <p className="mt-2 text-[13px] text-danger">{t(`err${state.code}`)}</p> : null}
      </div>
    </form>
  );
}
