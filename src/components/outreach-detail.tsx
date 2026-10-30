"use client";

import { useState } from "react";
import Link from "next/link";
import type { OutreachView } from "@/lib/outreach";
import { OUTREACH_CTAS, OUTREACH_TONES } from "@/lib/outreach";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

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
    <Badge data-testid="status-badge" variant="outline">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const selectClass =
  "mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
          className="rounded-md border border-accent bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          {view.inferenceMode === "mock" ? "MOCK output — " : ""}
          TEST / MOCK labeled demo. Not a real company, person, or send.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase">
            {view.companyName ?? "Company"} · v{view.version} · {view.channel}
          </p>
          <h1 className="font-serif mt-2 text-3xl tracking-tight">
            {view.subject || "Untitled draft"}
          </h1>
        </div>
        <StatusBadge status={view.status} />
      </div>

      <article className="border-y py-6">
        <p className="mb-4 text-xs text-muted-foreground">
          From <span className="text-foreground">Seed to Saga</span>
          {view.companyName ? (
            <>
              {" "}
              → {view.companyName}
            </>
          ) : null}
        </p>
        <p className="mb-4 font-semibold">{subject || "Untitled draft"}</p>
        <div className="space-y-3 text-[15px] leading-relaxed whitespace-pre-wrap">
          {body}
        </div>
      </article>

      <div className="flex flex-wrap gap-2">
        {canDecide && onApprove ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => onApprove(view.id))}
          >
            {pending ? <Spinner /> : null}
            Approve
          </Button>
        ) : null}
        {canReject && onReject ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => onReject(view.id))}
          >
            Reject
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          data-testid="dry-run-button"
          disabled={pending || !canDryRun}
          title={
            canDryRun
              ? "Records DRY_RUN_COMPLETED. Contacts nobody."
              : "Send (dry run) is allowed only when status is APPROVED"
          }
          onClick={() => canDryRun && onDryRun && run(() => onDryRun(view.id))}
        >
          Send (dry run)
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
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
        <Label>
          <span className="text-muted-foreground">Email subject</span>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1"
          />
        </Label>
        <Label>
          <span className="text-muted-foreground">Email body</span>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            className="mt-1"
          />
        </Label>
        <Label>
          <span className="text-muted-foreground">LinkedIn message</span>
          <Textarea
            value={linkedinMessage}
            onChange={(event) => setLinkedinMessage(event.target.value)}
            rows={4}
            className="mt-1"
          />
        </Label>
        <Button type="submit" variant="outline" disabled={pending}>
          Save edit
        </Button>
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
        <Label>
          <span className="text-muted-foreground">Tone</span>
          <select
            value={tone}
            onChange={(event) =>
              setTone(event.target.value as typeof tone)
            }
            className={selectClass}
          >
            {OUTREACH_TONES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          <span className="text-muted-foreground">CTA</span>
          <select
            value={cta}
            onChange={(event) => setCta(event.target.value as typeof cta)}
            className={selectClass}
          >
            {OUTREACH_CTAS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Label>
        <Button type="submit" variant="outline" disabled={pending}>
          Regenerate
        </Button>
      </form>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Cited signals</h2>
        {view.citedSignals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No cited signals stored on this draft.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.citedSignals.map((signal) => (
              <li key={signal.id}>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
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
                  </CardContent>
                </Card>
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

      <p className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
