"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  completeSetup,
  type SetupErrorCode,
  type SetupState,
} from "./actions";

export type SetupLabels = {
  password: string;
  passwordHint: string;
  confirm: string;
  submit: string;
  submitting: string;
  errors: Record<SetupErrorCode, string>;
};

/**
 * Two fields and one button. The strings arrive as props rather than through
 * `useMT`, because this screen is public and sits outside the manager shell
 * that provides the dictionary; the server component already holds a
 * translator and passes what this needs.
 */
export function SetupForm({
  token,
  minLength,
  labels,
}: {
  token: string;
  minLength: number;
  labels: SetupLabels;
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    completeSetup,
    {},
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">
          {labels.password}
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={minLength}
          autoFocus
          autoComplete="new-password"
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm
                     outline-none focus:border-muted"
        />
        <span className="mt-1 block text-[12.5px] text-muted">
          {labels.passwordHint}
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">
          {labels.confirm}
        </span>
        <input
          name="confirm"
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
          className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm
                     outline-none focus:border-muted"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {labels.errors[state.error]}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
        disabledReason={pending ? labels.submitting : undefined}
      >
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
