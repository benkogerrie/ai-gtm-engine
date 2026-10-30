"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? (
          <>
            <Spinner />
            Finding prospects…
          </>
        ) : (
          "Find prospects"
        )}
      </Button>
      {pending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Finding prospects… searching public sources. This can take a minute.
        </p>
      ) : null}
    </div>
  );
}
