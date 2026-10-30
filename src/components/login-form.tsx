"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

const initial: LoginState = {};

export function LoginForm({
  next,
  configured,
}: {
  next: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="mt-8 max-w-md space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="text-[var(--muted)]">APP_API_TOKEN</span>
        <input
          name="token"
          type="password"
          autoComplete="off"
          required
          disabled={!configured}
          className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
        />
      </label>
      {!configured ? (
        <p className="text-sm text-[var(--muted)]">
          Server auth is not configured. Set APP_API_TOKEN and APP_ORG_ID.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !configured}
        className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
