"use client";

import { useActionState } from "react";
import {
  draftOutreachAction,
  type OutreachActionState,
} from "@/app/actions/outreach";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { OUTREACH_CTAS, OUTREACH_TONES } from "@/lib/outreach";

export function DraftOutreachForm({
  companyId,
  companyName,
  citedCount,
  refuseMessage,
}: {
  companyId: string;
  companyName: string;
  citedCount: number;
  refuseMessage?: string;
}) {
  const [state, action, pending] = useActionState(
    draftOutreachAction,
    {} as OutreachActionState,
  );
  const canDraft = citedCount > 0;

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <p className="text-sm text-muted-foreground">
        Company id <span className="font-mono">{companyId}</span> · {companyName}
      </p>
      {!canDraft ? (
        <p className="text-sm text-destructive" role="alert">
          {refuseMessage ??
            "This company has no cited signal. Attach a citation before drafting."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {citedCount} cited signal{citedCount === 1 ? "" : "s"} available.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          <span className="text-muted-foreground">Tone</span>
          <select
            name="tone"
            defaultValue="professional"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {OUTREACH_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          <span className="text-muted-foreground">CTA</span>
          <select
            name="cta"
            defaultValue="book a call"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {OUTREACH_CTAS.map((cta) => (
              <option key={cta} value={cta}>
                {cta}
              </option>
            ))}
          </select>
        </Label>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !canDraft}>
        {pending ? (
          <>
            <Spinner />
            Drafting…
          </>
        ) : (
          "Draft outreach"
        )}
      </Button>
    </form>
  );
}
