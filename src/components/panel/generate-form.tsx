"use client";

import { useActionState, useState } from "react";
import { generate, type GenerateState } from "@/app/(manager)/exam/bank/actions";
import { ALLOWED_TYPES } from "@/lib/exam/item-generation";
import { CEFR_LEVELS, SECTIONS, type Section } from "@/lib/exam/types";
import { useMT } from "@/i18n/manager-client";

/** AI drafts for the bank. They land as drafts; approval stays with a person. */
export function GenerateForm() {
  const t = useMT("bank");
  const sec = useMT("sectionName");
  const [state, action, pending] = useActionState<GenerateState, FormData>(generate, null);
  const [section, setSection] = useState<Section>("GRAMMAR");
  const field = "mt-1 h-9 w-full rounded-[8px] border border-line bg-surface px-2 text-[13.5px] text-ink";
  return (
    <form action={action} className="rounded-[14px] border border-line bg-surface p-5">
      <div className="text-[14px] font-semibold text-ink">{t("generate")}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <label className="text-[12.5px] text-muted">
          {t("section")}
          <select name="section" value={section} onChange={(e) => setSection(e.target.value as Section)} className={field}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {sec(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] text-muted">
          {t("level")}
          <select name="level" defaultValue="B1" className={field}>
            {CEFR_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] text-muted">
          {t("type")}
          <select name="itemType" key={section} className={field}>
            {ALLOWED_TYPES[section].map((ty) => (
              <option key={ty} value={ty}>
                {t(`type${ty}` as "typeSINGLE_CHOICE")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] text-muted">
          {t("count")}
          <input name="count" type="number" min={1} max={10} defaultValue={3} className={field} />
        </label>
        <label className="text-[12.5px] text-muted">
          {t("topic")}
          <input name="topic" className={field} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="h-10 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted">
          {pending ? t("generating") : t("generate")}
        </button>
        {state?.ok ? <span className="text-[13px] text-ink">{t("generateDone", { n: state.created })}</span> : null}
        {state && !state.ok ? <span className="text-[13px] text-danger">{t("generateFailed", { reason: state.error })}</span> : null}
      </div>
    </form>
  );
}
