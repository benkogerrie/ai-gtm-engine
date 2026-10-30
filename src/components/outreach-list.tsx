"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  draftOutreachAction,
  seedDemoCompanyAction,
  type OutreachActionState,
} from "@/app/actions/outreach";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { OUTREACH_CTAS, OUTREACH_TONES, SELLER_PRODUCT } from "@/lib/outreach";

export type OutreachListRow = {
  id: string;
  companyName: string | null;
  companyDomain: string | null;
  status: string;
  updatedAt: string;
  labeledTest: boolean;
  inferenceMode: string;
};

export type OutreachCompanyOption = {
  id: string;
  name: string;
  domain: string | null;
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>;
}

const selectClass =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OutreachList({
  rows,
  companies,
  selectedCompanyId,
}: {
  rows: OutreachListRow[];
  companies: OutreachCompanyOption[];
  selectedCompanyId?: string;
}) {
  const [draftState, draftAction, draftPending] = useActionState(
    draftOutreachAction,
    {} as OutreachActionState,
  );
  const [seedState, seedAction, seedPending] = useActionState(
    seedDemoCompanyAction,
    {} as OutreachActionState,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Outreach</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {SELLER_PRODUCT.name} ({SELLER_PRODUCT.description}) drafts from cited
          hospital signals only. A human must approve / edit / reject before
          Send (dry run). There is no real send path. /prospects can link to{" "}
          <code className="font-mono text-xs">/outreach/new?companyId=</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Draft outreach</CardTitle>
          <p className="text-sm text-muted-foreground">
            Takes a company id. Refuses if that company has no cited signal.
          </p>
        </CardHeader>
        <CardContent>
          <form action={draftAction} className="grid gap-4 sm:grid-cols-2">
            <Label className="sm:col-span-2">
              <span className="text-muted-foreground">Company</span>
              <select
                name="companyId"
                required
                className={selectClass}
                defaultValue={selectedCompanyId ?? ""}
              >
                <option value="" disabled>
                  Select a company
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.domain ? ` · ${company.domain}` : ""}
                  </option>
                ))}
              </select>
            </Label>
            <Label>
              <span className="text-muted-foreground">Tone</span>
              <select name="tone" defaultValue="professional" className={selectClass}>
                {OUTREACH_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone}
                  </option>
                ))}
              </select>
            </Label>
            <Label>
              <span className="text-muted-foreground">CTA</span>
              <select name="cta" defaultValue="book a call" className={selectClass}>
                {OUTREACH_CTAS.map((cta) => (
                  <option key={cta} value={cta}>
                    {cta}
                  </option>
                ))}
              </select>
            </Label>
            {draftState.error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {draftState.error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={draftPending || companies.length === 0}
            >
              {draftPending ? (
                <>
                  <Spinner />
                  Drafting…
                </>
              ) : (
                "Draft outreach"
              )}
            </Button>
          </form>
          {companies.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {companies.map((company) => (
                <li
                  key={company.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <span className="text-sm">
                    {company.name}
                    {company.domain ? (
                      <span className="text-muted-foreground"> · {company.domain}</span>
                    ) : null}
                  </span>
                  <DraftOutreachButton companyId={company.id} />
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-accent bg-accent">
        <CardHeader>
          <CardTitle>Seed TEST company</CardTitle>
          <p className="text-sm text-accent-foreground">
            Creates one labeled hospital prospect for {SELLER_PRODUCT.name}: TEST
            — Example General Hospital / example.com /{" "}
            <span className="font-mono">https://example.com</span>. Not a real
            hospital.
          </p>
        </CardHeader>
        <CardContent>
          <form action={seedAction}>
            <Button type="submit" variant="outline" disabled={seedPending}>
              {seedPending ? (
                <>
                  <Spinner />
                  Seeding…
                </>
              ) : (
                "Seed TEST company"
              )}
            </Button>
          </form>
          {seedState.error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {seedState.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section>
        <div className="flex items-end justify-between border-b pb-3">
          <h2 className="font-serif text-xl tracking-tight">Drafts</h2>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {rows.length} rows
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No outreach yet. Seed the TEST company, then draft.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <Link
                  href={`/outreach/${row.id}`}
                  className="min-w-48 flex-1 font-medium hover:underline"
                >
                  {row.companyName ?? "Unknown company"}
                </Link>
                {row.labeledTest ? (
                  <Badge variant="inferred">TEST / MOCK</Badge>
                ) : null}
                <StatusBadge status={row.status} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(row.updatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
