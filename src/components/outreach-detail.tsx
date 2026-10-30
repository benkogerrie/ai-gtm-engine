"use client";

import { useState } from "react";
import Link from "next/link";
import type { OutreachView } from "@/lib/outreach";
import { OUTREACH_CTAS, OUTREACH_TONES } from "@/lib/outreach";

export type OutreachDetailView = Omit<
  OutreachView,
  "createdAt" | "updatedAt" | "sentAt"
> & {
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid="status-badge"
      className="rounded-full border border-[var(--rule)] px-3 py-1 text-xs uppercase"
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function OutreachDetail({
  view,
  onSave,
  onRegenerate,
  onApprove,
  onReject,
  onDryRun,
}: {
  view: OutreachDetailView;
  onSave?: (
    id: string,
    input: { subject: string; body: string; linkedinMessage: string },
  ) => Promise<{ error?: string; nextId?: string }>;
  onRegenerate?: (
    id: string,
    input: { tone: string; cta: string },
  ) => Promise<{ error?: string; nextId?: string }>;
  onApprove?: (id: string) => Promise<{ error?: string }>;
  onReject?: (id: string) => Promise<{ error?: string }>;
  onDryRun?: (id: string) => Promise<{ error?: string }>;
}) {
  const [subject, setSubject] = useState(view.subject ?? "");
  const [body, setBody] = useState(view.body);
  const [linkedinMessage, setLinkedinMessage] = useState(view.linkedinMessage);
  const [tone, setTone] = useState(view.tone);
  const [cta, setCta] = useState(view.cta);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canDecide = view.status === "DRAFT" || view.status === "PENDING_APPROVAL";
  const canDryRun = view.status === "APPROVED";
  const canReject =
    canDecide || view.status === "APPROVED";

  async function run(work: () => Promise<{ error?: string } | void>) {
    setPending(true);
    setError(null);
    try {
      const result = await work();
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {view.labeledTest ? (
        <p
          data-testid="mock-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
        >
          {view.inferenceMode === "mock" ? "MOCK output — " : ""}
          TEST / MOCK labeled demo. Not a real company, person, or send.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
            {view.companyName ?? "Company"} · v{view.version} · {view.channel}
          </p>
          <h1 className="font-serif mt-2 text-3xl tracking-tight">
            {view.subject || "Untitled draft"}
          </h1>
        </div>
        <StatusBadge status={view.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {canDecide && onApprove ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => onApprove(view.id))}
            className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
          >
            Approve
          </button>
        ) : null}
        {canReject && onReject ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => onReject(view.id))}
            className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Reject
          </button>
        ) : null}
        <button
          type="button"
          data-testid="dry-run-button"
          disabled={pending || !canDryRun}
          title={
            canDryRun
              ? "Records DRY_RUN_COMPLETED. Contacts nobody."
              : "Send (dry run) is allowed only when status is APPROVED"
          }
          onClick={() => canDryRun && onDryRun && run(() => onDryRun(view.id))}
          className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Send (dry run)
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!onSave) {
            return;
          }
          void run(() =>
            onSave(view.id, { subject, body, linkedinMessage }),
          );
        }}
      >
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Email subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Email body</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">LinkedIn message</span>
          <textarea
            value={linkedinMessage}
            onChange={(event) => setLinkedinMessage(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
        >
          Save edit
        </button>
      </form>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!onRegenerate) {
            return;
          }
          void run(() => onRegenerate(view.id, { tone, cta }));
        }}
      >
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Tone</span>
          <select
            value={tone}
            onChange={(event) =>
              setTone(event.target.value as typeof tone)
            }
            className="mt-1 rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          >
            {OUTREACH_TONES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">CTA</span>
          <select
            value={cta}
            onChange={(event) => setCta(event.target.value as typeof cta)}
            className="mt-1 rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
          >
            {OUTREACH_CTAS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
        >
          Regenerate
        </button>
      </form>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Cited signals</h2>
        {view.citedSignals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No cited signals stored on this draft.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.citedSignals.map((signal) => (
              <li
                key={signal.id}
                className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
              >
                <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
                  {signal.kind} · {signal.type}
                </p>
                <p className="mt-1 text-sm">{signal.summary}</p>
                <ul className="mt-2 space-y-1">
                  {signal.sourceUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Source URLs used</h2>
        <ul className="mt-2 space-y-1">
          {view.sourceUrls.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <Link href="/outreach" className="underline">
          Back to outreach
        </Link>
        {view.companyId ? (
          <Link
            href={`/outreach/new?companyId=${encodeURIComponent(view.companyId)}`}
            className="underline"
          >
            Prospect draft
          </Link>
        ) : null}
        <Link href="/prospects" className="underline">
          Prospects
        </Link>
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>
        <span>Dry-run never contacts anyone.</span>
      </p>
    </div>
  );
}
