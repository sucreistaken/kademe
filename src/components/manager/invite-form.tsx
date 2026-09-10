"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createInvite, type InviteResult } from "@/app/(manager)/candidates/new/actions";
import { useMT } from "@/i18n/manager-client";
import { useLocale } from "next-intl";

export type TemplateOption = {
  versionId: string;
  positionName: string;
  templateName: string;
  /** The languages this version's questions were actually written in. */
  locales: ReadonlyArray<"tr" | "en">;
  defaultLocale: "tr" | "en";
};

/**
 * Daily job number one: name, email, template, copy link. Four fields, one
 * screen, no wizard. Anything that adds a step here costs the product its
 * "no brainer" claim.
 */
export function InviteForm({ options }: { options: TemplateOption[] }) {
  const t = useMT("invite");
  const errors = useMT("inviteErrors");
  const [state, formAction, pending] = useActionState<InviteResult, FormData>(
    createInvite,
    { status: "idle" },
  );
  // The language belongs to the version, so the field has to follow the select
  // above it: a template written only in Turkish must not offer English.
  const [versionId, setVersionId] = useState(options[0]?.versionId ?? "");
  const chosen = options.find((option) => option.versionId === versionId) ?? options[0];
  const languages = chosen?.locales ?? ["tr"];
  const [locale, setLocale] = useState<"tr" | "en">(
    options[0]?.defaultLocale ?? "tr",
  );
  // Switching to a template that was not written in the chosen language would
  // otherwise leave a stale value in the select.
  const chosenLocale = languages.includes(locale)
    ? locale
    : (chosen?.defaultLocale ?? languages[0]);
  const langLabel = (code: "tr" | "en") => (code === "tr" ? t("langTr") : t("langEn"));

  if (state.status === "created") {
    return <CreatedLink state={state} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label={t("fullName")} htmlFor="fullName">
        <input
          id="fullName"
          name="fullName"
          required
          autoFocus
          autoComplete="off"
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
        />
      </Field>

      <Field label={t("email")} htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
        />
      </Field>

      <Field label={t("template")} htmlFor="versionId">
        <select
          id="versionId"
          name="versionId"
          required
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-2.5 text-sm"
        >
          {options.map((option) => (
            <option key={option.versionId} value={option.versionId}>
              {option.positionName} · {option.templateName}
            </option>
          ))}
        </select>
      </Field>

      {/* One language: nothing to decide, so it is a sentence rather than a
          control. Two: a real choice, because it decides the invitation and
          everything the candidate reads afterwards. */}
      {languages.length > 1 ? (
        <Field label={t("language")} htmlFor="locale">
          <select
            id="locale"
            name="locale"
            value={chosenLocale}
            onChange={(event) => setLocale(event.target.value as "tr" | "en")}
            className="h-10 w-full rounded-[10px] border border-line bg-surface px-2.5 text-sm"
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {langLabel(code)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12.5px] text-muted">{t("languageHint")}</p>
        </Field>
      ) : (
        <>
          <input type="hidden" name="locale" value={languages[0]} />
          <p className="text-[12.5px] text-muted">
            {t("languageOnly", { lang: langLabel(languages[0]) })}
          </p>
        </>
      )}

      {state.status === "error" && (
        <p className="text-[13px] text-danger">{errors(state.code)}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
        <span className="text-[13px] text-muted">{t("noEmailSent")}</span>
      </div>
    </form>
  );
}

function CreatedLink({
  state,
}: {
  state: Extract<InviteResult, { status: "created" }>;
}) {
  const t = useMT("invite");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  // This branch only ever renders after the action resolved, so it is client
  // side by definition. The guard is there for the type checker, not for a
  // server render that can happen.
  const url =
    typeof window === "undefined" ? "" : `${window.location.origin}/a/${state.token}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-medium">
          {t("ready", { name: state.candidateName })}
        </p>
        <p className="mt-1 text-[13px] text-muted">{t("readyHint")}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label={t("linkLabel")}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 flex-1 rounded-[10px] border border-line bg-canvas px-3 font-mono
                     text-[12.5px]"
        />
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>

      <p className="text-[13px] text-muted">
        {t("expiresOn", {
          date: new Date(state.expiresAt).toLocaleDateString(
            locale === "tr" ? "tr-TR" : "en-GB",
          ),
        })}
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button asChild variant="secondary" size="sm">
          <Link href="/candidates/new">{t("inviteAnother")}</Link>
        </Button>
        <Link
          href={`/candidates/${state.candidateId}`}
          className="text-[13px] font-medium text-accent hover:underline"
        >
          {t("goToCandidate")}
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
