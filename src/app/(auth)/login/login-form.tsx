"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

/**
 * Strings arrive as props rather than through `useMT`. This route sits outside
 * the manager shell, so there is no dictionary provider above it, and the same
 * is true of the setup screen an invited user lands on first.
 */
export type LoginCopy = {
  /** Absent in panel-password mode: the form then asks for the password only. */
  email?: string;
  password: string;
  submit: string;
  checking: string;
  invalid: string;
};

const field =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm " +
  "outline-none focus:border-muted";

export function LoginForm({ copy }: { copy: LoginCopy }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const withEmail = copy.email !== undefined;

  return (
    <form action={action} className="mt-6 space-y-4">
      {withEmail ? (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">{copy.email}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            className={field}
          />
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium">{copy.password}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          autoFocus={!withEmail}
          className={field}
        />
      </label>

      {state.code ? (
        <p role="alert" className="text-[13px] text-danger">
          {copy.invalid}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
        disabledReason={pending ? copy.checking : undefined}
      >
        {pending ? copy.checking : copy.submit}
      </Button>
    </form>
  );
}
