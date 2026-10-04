"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/exam-flow";

type InfoValues = { fullName: string; email: string; phone: string; location: string };
import { useT } from "@/i18n/candidate-client";

/**
 * Four fields, asked once. Validation happens as the candidate types rather
 * than after they press the button, so nobody fills a form and then gets it
 * handed back.
 */
export function InfoForm({
  token,
  initial,
}: {
  token: string;
  initial: InfoValues;
}) {
  const router = useRouter();
  const t = useT("info");
  const common = useT("common");
  const [form, setForm] = useState<InfoValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = form.fullName.trim().length >= 2;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const ready = nameOk && emailOk;

  const reason = !nameOk
    ? t("nameRequired")
    : !emailOk
      ? t("emailInvalid")
      : "";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CandidateState & { path?: string }>(token, "/info", form);
      router.push(nextPath(token, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : common("somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <CandidateColumn width={600}>
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm leading-[1.6] text-muted">{t("body")}</p>

      <div className="mt-7 flex flex-col gap-4">
        <Field
          label={t("fullName")}
          value={form.fullName}
          onChange={(v) => setForm({ ...form, fullName: v })}
          autoComplete="name"
        />
        <Field
          label={t("email")}
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          type="email"
          autoComplete="email"
        />
        <Field
          label={t("phone")}
          hint={t("optional")}
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          autoComplete="tel"
        />
        <Field
          label={t("city")}
          hint={t("optional")}
          value={form.location}
          onChange={(v) => setForm({ ...form, location: v })}
          autoComplete="address-level2"
        />
      </div>

      <button
        type="button"
        id="info-next"
        disabled={!ready || busy}
        onClick={submit}
        aria-describedby={!ready ? "info-next-why" : undefined}
        className={
          ready && !busy
            ? "mt-7 w-full rounded-[10px] border border-accent bg-accent px-4 py-[15px] text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
            : "mt-7 w-full cursor-not-allowed rounded-[10px] border border-line bg-disabled px-4 py-[15px] text-[14.5px] font-semibold text-ink-3"
        }
      >
        {busy ? t("saving") : t("next")}
      </button>
      {!ready ? (
        <p id="info-next-why" className="mt-[9px] text-center text-[12.5px] text-muted">
          {reason}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-center text-[13px] text-danger">{error}</p>
      ) : null}
    </CandidateColumn>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-muted">{hint}</span> : null}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}
