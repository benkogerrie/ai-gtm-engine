import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import {
  getDiscoveryPageAuth,
  getDiscoveryRun,
  isDiscoveryConfigured,
  listDiscoveryRuns,
  type DiscoveryRunSnapshot,
} from "@/lib/discovery";
import { ProspectsForm } from "./prospects-form";

export const maxDuration = 60;

function MockBadge({ mode }: { mode: "LIVE" | "MOCK" }) {
  if (mode !== "MOCK") {
    return null;
  }
  return (
    <span className="rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
      MOCK
    </span>
  );
}

function RunPanel({ run }: { run: DiscoveryRunSnapshot }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-2xl tracking-tight">Prospects</h2>
        <MockBadge mode={run.mode} />
        <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
          {run.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {run.prospects.length} companies · {run.rejectedClaimCount} unsupported
        claims dropped · {run.droppedCompanyCount} companies dropped
      </p>
      {run.error ? (
        <p className="mt-3 text-sm text-red-800">{run.error}</p>
      ) : null}

      {run.prospects.length === 0 ? (
        <p className="mt-6 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
          {run.mode === "MOCK"
            ? "MOCK run: synthetic search hits are never stored as citations, so no fabricated companies are shown. Add BRAVE_SEARCH_API_KEY and DEEPSEEK_API_KEY for a live run."
            : "No cited prospects survived validation for this run."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--rule)] bg-[var(--card)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--rule)] text-xs tracking-wide text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Fit</th>
                <th className="px-4 py-3">Rationale & signals</th>
                <th className="px-4 py-3">Sources</th>
              </tr>
            </thead>
            <tbody>
              {run.prospects.map((prospect) => (
                <tr
                  key={prospect.companyId ?? prospect.domain}
                  className="border-b border-[var(--rule)] last:border-b-0 align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{prospect.name}</p>
                    <p className="text-xs text-[var(--muted)]">{prospect.domain}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {prospect.fitScore}
                  </td>
                  <td className="px-4 py-3">
                    <p>{prospect.rationale}</p>
                    {prospect.signals.length > 0 ? (
                      <ul className="mt-2 list-disc pl-4 text-xs text-[var(--muted)]">
                        {prospect.signals.map((signal) => (
                          <li key={`${signal.sourceUrl}-${signal.summary}`}>
                            {signal.summary}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="grid gap-1">
                      {prospect.claims.map((claim) => (
                        <li key={`${claim.field}-${claim.sourceUrl}`}>
                          <a
                            href={claim.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-[var(--rule)] underline-offset-2"
                          >
                            {claim.field}: {claim.value}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {run.competitorCategories.length > 0 ? (
        <div className="mt-8">
          <h3 className="font-serif text-xl tracking-tight">
            Competitor categories
          </h3>
          <ul className="mt-4 grid gap-3">
            {run.competitorCategories.map((category) => (
              <li
                key={`${category.category}-${category.sourceUrl}`}
                className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4 text-sm"
              >
                <p className="font-medium">{category.category}</p>
                {category.examples.length > 0 ? (
                  <p className="mt-1 text-[var(--muted)]">
                    {category.examples.join(", ")}
                  </p>
                ) : null}
                <a
                  href={category.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block underline decoration-[var(--rule)] underline-offset-2"
                >
                  Source
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

async function ProspectsBody({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string; error?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const auth = getDiscoveryPageAuth();
  const db = await getDb();
  const configured = isDiscoveryConfigured();

  const selected = params.runId
    ? await getDiscoveryRun(db, auth.orgId, params.runId)
    : null;
  const runs = selected ? [selected] : await listDiscoveryRuns(db, auth.orgId, 5);
  const run = selected ?? runs[0] ?? null;

  return (
    <>
      {params.error === "invalid" ? (
        <p className="mb-4 text-sm text-red-800">
          Product summary and at least one industry are required.
        </p>
      ) : null}
      <p className="mb-4 text-xs text-[var(--muted)]">
        Search {configured.search ? "configured" : "MOCK (no Brave key)"} · LLM{" "}
        {configured.llm ? "configured" : "MOCK (no DeepSeek key)"}
      </p>
      <ProspectsForm />
      {run ? <RunPanel run={run} /> : null}
    </>
  );
}

export default function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <p className="text-sm font-medium tracking-[0.18em] uppercase">
            AI GTM Engine
          </p>
          <Link href="/" className="text-xs tracking-wide text-[var(--muted)]">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        <p className="text-xs font-medium tracking-[0.22em] text-[var(--muted)] uppercase">
          B004 · Live discovery
        </p>
        <h1 className="font-serif mt-4 text-4xl tracking-tight">Prospects</h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          From an ICP slice, search live public sources, keep only claims that
          cite a result URL from this run, and persist evidence-backed companies.
        </p>
        <div className="mt-10">
          <Suspense
            fallback={
              <p className="text-sm text-[var(--muted)]">Loading runs…</p>
            }
          >
            <ProspectsBody searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
