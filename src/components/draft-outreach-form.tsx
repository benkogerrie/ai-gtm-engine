"use client";

import { useActionState } from "react";
import {
  draftOutreachAction,
  type OutreachActionState,
} from "@/app/actions/outreach";
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
      <p className="text-sm text-[var(--muted)]">
        Company id <span className="font-mono">{companyId}</span> · {companyName}
      </p>
      {!canDraft ? (
        <p className="text-sm text-red-800" role="alert">
          {refuseMessage ??
            "This company has no cited signal. Attach a citation before drafting."}
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {citedCount} cited signal{citedCount === 1 ? "" : "s"} available.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Tone</span>
          <select
            name="tone"
            defaultValue="professional"
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          >
            {OUTREACH_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">CTA</span>
          <select
            name="cta"
            defaultValue="book a call"
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          >
            {OUTREACH_CTAS.map((cta) => (
              <option key={cta} value={cta}>
                {cta}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !canDraft}
        className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
      >
        {pending ? "Drafting…" : "Draft outreach"}
      </button>
    </form>
  );
}
