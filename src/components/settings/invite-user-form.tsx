"use client";

import { useActionState, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { InlineLink } from "@/components/ui/inline-link";
import {
  inviteUser,
  type InviteUserResult,
} from "@/app/(manager)/settings/actions";
import { useMT } from "@/i18n/manager-client";

export type RoleOption = {
  value: string;
  label: string;
  help: string;
};

/**
 * Name, address, role, one button. The same shape as the candidate invitation
 * on purpose: the owner never types a password for anybody, they hand over a
 * one-time link and the person sets their own.
 */
export function InviteUserForm({ roleOptions }: { roleOptions: RoleOption[] }) {
  // "Invite someone else" points at the route this component already lives on,
  // so navigating there would leave the finished state on screen. Remounting on
  // a key is the reset that `useActionState` does not offer.
  const [round, setRound] = useState(0);
  return (
    <InviteRound
      key={round}
      roleOptions={roleOptions}
      onAgain={() => setRound((n) => n + 1)}
    />
  );
}

function InviteRound({
  roleOptions,
  onAgain,
}: {
  roleOptions: RoleOption[];
  onAgain: () => void;
}) {
  const t = useMT("userInvite");
  const errors = useMT("userInviteErrors");
  const [state, formAction, pending] = useActionState<InviteUserResult, FormData>(
    inviteUser,
    { status: "idle" },
  );
  const [role, setRole] = useState(roleOptions[0]?.value ?? "");
  const chosen = roleOptions.find((option) => option.value === role);

  if (state.status === "created") {
    return <CreatedLink state={state} onAgain={onAgain} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label={t("name")} htmlFor="name">
        <input
          id="name"
          name="name"
          required
          autoFocus
          autoComplete="off"
          maxLength={120}
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
          maxLength={200}
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm"
        />
      </Field>

      <Field label={t("role")} htmlFor="role">
        <select
          id="role"
          name="role"
          required
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-2.5 text-sm"
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* What the role actually allows, next to the choice rather than in a
            table the person has to go back to. */}
        {chosen && <p className="mt-1 text-[12.5px] text-muted">{chosen.help}</p>}
      </Field>

      {state.status === "error" && (
        <p className="text-[13px] text-danger">{errors(state.code)}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
        <span className="text-[13px] text-muted">{t("noEmailSent")}</span>
      </div>

      <p className="text-[12.5px] text-muted">{t("reinviteHint")}</p>
    </form>
  );
}

function CreatedLink({
  state,
  onAgain,
}: {
  state: Extract<InviteUserResult, { status: "created" }>;
  onAgain: () => void;
}) {
  const t = useMT("userInvite");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  // This branch only ever renders after the action resolved, so it is client
  // side by definition. The guard is there for the type checker, not for a
  // server render that can happen.
  const url =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/setup/${state.token}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-medium">
          {state.reissued
            ? t("readyReissued", { name: state.name })
            : t("ready", { name: state.name })}
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
        <Button variant="secondary" size="sm" onClick={onAgain}>
          {t("inviteAnother")}
        </Button>
        <InlineLink href="/settings" className="text-[13px]">
          {t("goToSettings")}
        </InlineLink>
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
