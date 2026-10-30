"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  draftOutreachAction,
  seedDemoCompanyAction,
  type OutreachActionState,
} from "@/app/actions/outreach";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
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
  return (
    <span className="rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase">
      {status.replaceAll("_", " ")}
    </span>
  );
}

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
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          {SELLER_PRODUCT.name} ({SELLER_PRODUCT.description}) drafts from cited
          hospital signals only. A human must approve / edit / reject before
          Send (dry run). There is no real send path. /prospects can link to{" "}
          <code className="font-mono text-xs">/outreach/new?companyId=</code>.
        </p>
      </div>

      <section className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5">
        <h2 className="font-serif text-xl tracking-tight">Draft outreach</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Takes a company id. Refuses if that company has no cited signal.
        </p>
        <form action={draftAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Company</span>
            <select
              name="companyId"
              required
              className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
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
          </label>
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
          {draftState.error ? (
            <p className="text-sm text-red-800 sm:col-span-2" role="alert">
              {draftState.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={draftPending || companies.length === 0}
            className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
          >
            {draftPending ? "Drafting…" : "Draft outreach"}
          </button>
        </form>
        {companies.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {companies.map((company) => (
              <li
                key={company.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--rule)] px-3 py-2"
              >
                <span className="text-sm">
                  {company.name}
                  {company.domain ? (
                    <span className="text-[var(--muted)]"> · {company.domain}</span>
                  ) : null}
                </span>
                <DraftOutreachButton companyId={company.id} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-serif text-xl tracking-tight">
          Seed TEST company
        </h2>
        <p className="mt-1 text-sm">
          Creates one labeled hospital prospect for {SELLER_PRODUCT.name}: TEST
          — Example General Hospital / example.com /{" "}
          <span className="font-mono">https://example.com</span>. Not a real
          hospital.
        </p>
        <form action={seedAction} className="mt-4">
          <button
            type="submit"
            disabled={seedPending}
            className="rounded-md border border-[var(--rule)] bg-[var(--card)] px-4 py-2 text-sm disabled:opacity-50"
          >
            {seedPending ? "Seeding…" : "Seed TEST company"}
          </button>
        </form>
        {seedState.error ? (
          <p className="mt-2 text-sm text-red-800" role="alert">
            {seedState.error}
          </p>
        ) : null}
      </section>

      <section>
        <div className="flex items-end justify-between border-b border-[var(--rule)] pb-3">
          <h2 className="font-serif text-xl tracking-tight">Drafts</h2>
          <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
            {rows.length} rows
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No outreach yet. Seed the TEST company, then draft.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--rule)]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <Link
                  href={`/outreach/${row.id}`}
                  className="min-w-48 flex-1 font-medium hover:underline"
                >
                  {row.companyName ?? "Unknown company"}
                </Link>
                {row.labeledTest ? (
                  <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase">
                    TEST / MOCK
                  </span>
                ) : null}
                <StatusBadge status={row.status} />
                <span className="text-xs text-[var(--muted)] tabular-nums">
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
