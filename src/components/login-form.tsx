"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

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
      <Label>
        <span className="text-muted-foreground">APP_API_TOKEN</span>
        <Input
          name="token"
          type="password"
          autoComplete="off"
          required
          disabled={!configured}
          className="mt-1"
        />
      </Label>
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Server auth is not configured. Set APP_API_TOKEN and APP_ORG_ID.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !configured}>
        {pending ? (
          <>
            <Spinner />
            Signing in…
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}
