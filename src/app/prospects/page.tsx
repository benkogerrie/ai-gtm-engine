import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDb } from "@/db/client";
import {
  getDiscoveryPageAuth,
  getDiscoveryRun,
  isDiscoveryConfigured,
  listDiscoveryRuns,
  type DiscoveryRunSnapshot,
} from "@/lib/discovery";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { EvidenceLabelBadge, EvidenceLegend } from "@/components/evidence-label";
import { labelDiscoveryClaim } from "@/lib/discovery/labels";
import { aggregateByOrganization } from "@/lib/discovery/names";
import { ProspectsForm } from "./prospects-form";

export const maxDuration = 60;
export const instant = false;

function ModeBadge({ mode }: { mode: "LIVE" | "MOCK" }) {
  const live = mode === "LIVE";
  return (
    <span
      className={
        live
          ? "rounded-full bg-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-white uppercase"
          : "rounded-full border border-[var(--rule)] bg-[var(--card)] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase"
      }
    >
      {live ? "LIVE" : "MOCK"}
    </span>
  );
}

function pathLabel(run: DiscoveryRunSnapshot): string {
  const extraction = run.extractionPath ?? (run.mode === "LIVE" ? "deepseek" : "heuristic");
  const scoring = run.scoringPath ?? extraction;
  if (extraction === "deepseek" && scoring === "deepseek") {
    return "Path: DeepSeek extraction + scoring";
  }
  if (extraction === "heuristic") {
    return "Path: heuristic (MOCK)";
  }
  return `Path: extract ${extraction} · score ${scoring}`;
}

function uniqueSources(
  claims: DiscoveryRunSnapshot["prospects"][number]["claims"],
) {
  const seen = new Set<string>();
  const sources: Array<{
    url: string;
    title: string;
    domain: string;
    field: string;
  }> = [];
  for (const claim of claims) {
    if (seen.has(claim.sourceUrl)) {
      continue;
    }
    seen.add(claim.sourceUrl);
    let domain = claim.sourceDomain ?? "";
    if (!domain) {
      try {
        domain = new URL(claim.sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        domain = claim.sourceUrl;
      }
    }
    const title = claim.sourceTitle?.trim() || domain;
    sources.push({ url: claim.sourceUrl, title, domain, field: claim.field });
  }
  return sources;
}

function RunPanel({ run }: { run: DiscoveryRunSnapshot }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-2xl tracking-tight">Prospects</h2>
        <ModeBadge mode={run.mode} />
        <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
          {run.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {run.prospects.length} companies · {run.rejectedClaimCount} unsupported
        claims dropped · {run.droppedCompanyCount} companies dropped
        {run.icpId ? ` · ICP ${run.icpId.slice(0, 8)}` : ""}
      </p>
      <p className="mt-1 text-xs tracking-wide text-[var(--muted)] uppercase">
        {pathLabel(run)}
      </p>
      {run.error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {run.error}
        </p>
      ) : null}

      {aggregateByOrganization(run.prospects).length === 0 ? (
        <p className="mt-6 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
          {run.status === "failed"
            ? "This run failed. The live DeepSeek path does not silently fall back to a heuristic."
            : run.mode === "MOCK"
              ? "MOCK run: synthetic search hits are never stored as citations, so no fabricated companies are shown. Add BRAVE_SEARCH_API_KEY and DEEPSEEK_API_KEY for a live run."
              : "No cited buyer organizations survived validation for this run."}
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
              {aggregateByOrganization(run.prospects).map((prospect) => (
                <tr
                  key={prospect.companyId ?? `${prospect.name}-${prospect.domain}`}
                  className="border-b border-[var(--rule)] last:border-b-0 align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{prospect.name}</p>
                    {prospect.domain ? (
                      prospect.websiteUrl ? (
                        <a
                          href={prospect.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--muted)] underline decoration-[var(--rule)] underline-offset-2"
                        >
                          {prospect.domain}
                        </a>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">
                          {prospect.domain}
                        </p>
                      )
                    ) : null}
                    {prospect.companyId ? (
                      <div className="mt-2">
                        <DraftOutreachButton companyId={prospect.companyId} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p>{prospect.fitScore}</p>
                    <EvidenceLabelBadge label="INFERRED" />
                    {prospect.evidenceRelevance ? (
                      <p className="mt-1 text-[10px] tracking-wide text-[var(--muted)] uppercase">
                        {prospect.evidenceRelevance} evidence
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{prospect.rationale}</p>
                    <div className="mt-1">
                      <EvidenceLabelBadge label="INFERRED" />
                    </div>
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
                      {uniqueSources(prospect.claims).map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-[var(--rule)] underline-offset-2"
                          >
                            {source.title}
                            {source.domain && source.title !== source.domain
                              ? ` · ${source.domain}`
                              : ""}
                          </a>{" "}
                          <EvidenceLabelBadge
                            label={labelDiscoveryClaim({
                              field: source.field,
                              sourceUrl: source.url,
                            })}
                          />
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
            {run.competitorCategories.map((category) => {
              let domain = "";
              try {
                domain = new URL(category.sourceUrl).hostname.replace(/^www\./, "");
              } catch {
                domain = category.sourceUrl;
              }
              return (
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
                    {domain}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

async function ProspectsBody({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string; error?: string; icp?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const next = params.icp
    ? `/prospects?icp=${encodeURIComponent(params.icp)}`
    : "/prospects";
  const auth = await getDiscoveryPageAuth();
  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const db = await getDb();
  const configured = isDiscoveryConfigured();

  const selected = params.runId
    ? await getDiscoveryRun(db, auth.orgId, params.runId)
    : null;
  const runs = selected
    ? [selected]
    : await listDiscoveryRuns(db, auth.orgId, {
        limit: 5,
        icpId: params.icp,
      });
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
        {params.icp ? ` · linked ICP ${params.icp.slice(0, 8)}` : ""}
      </p>
      <ProspectsForm icpId={params.icp} />
      {run ? <RunPanel run={run} /> : null}
    </>
  );
}

export default function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string; error?: string; icp?: string }>;
}) {
  return (
    <AppShell eyebrow="B004 · Live discovery" showLogout>
      <h1 className="font-serif text-4xl tracking-tight">Prospects</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        From an approved ICP, search live public sources for named buyer
        organizations. Only claims that cite a result URL from this run are kept.
        Duplicate rows for the same organization are collapsed.
      </p>
      <div className="mt-4">
        <EvidenceLegend />
      </div>
      <div className="mt-10">
        <Suspense
          fallback={
            <p className="text-sm text-[var(--muted)]">Loading runs…</p>
          }
        >
          <ProspectsBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
