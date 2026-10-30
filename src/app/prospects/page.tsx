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
import {
  EvidenceLabelBadge,
  EvidenceLegend,
  EvidenceRelevanceBadge,
} from "@/components/evidence-label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { labelDiscoveryClaim } from "@/lib/discovery/labels";
import { aggregateByOrganization } from "@/lib/discovery/names";
import { ProspectsForm } from "./prospects-form";

export const maxDuration = 60;
export const instant = false;

function ModeBadge({ mode }: { mode: "LIVE" | "MOCK" }) {
  return (
    <Badge variant={mode === "LIVE" ? "verified" : "outline"}>
      {mode === "LIVE" ? "LIVE" : "MOCK"}
    </Badge>
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
        <Badge variant="outline">{run.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {run.prospects.length} companies · {run.rejectedClaimCount} unsupported
        claims dropped · {run.droppedCompanyCount} companies dropped
        {run.icpId ? ` · ICP ${run.icpId.slice(0, 8)}` : ""}
      </p>
      <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
        {pathLabel(run)}
      </p>
      {run.error ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-secondary px-3 py-2 text-sm text-destructive">
          {run.error}
        </p>
      ) : null}

      {aggregateByOrganization(run.prospects).length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-5 text-sm text-muted-foreground">
            {run.status === "failed"
              ? "This run failed. The live DeepSeek path does not silently fall back to a heuristic."
              : run.mode === "MOCK"
                ? "MOCK run: synthetic search hits are never stored as citations, so no fabricated companies are shown. Add BRAVE_SEARCH_API_KEY and DEEPSEEK_API_KEY for a live run."
                : "No cited buyer organizations survived validation for this run."}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead>Rationale & signals</TableHead>
                <TableHead>Sources</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregateByOrganization(run.prospects).map((prospect) => (
                <TableRow
                  key={prospect.companyId ?? `${prospect.name}-${prospect.domain}`}
                >
                  <TableCell>
                    <p className="font-medium">{prospect.name}</p>
                    {prospect.domain ? (
                      prospect.websiteUrl ? (
                        <a
                          href={prospect.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground underline underline-offset-2"
                        >
                          {prospect.domain}
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {prospect.domain}
                        </p>
                      )
                    ) : null}
                    {prospect.companyId ? (
                      <div className="mt-2">
                        <DraftOutreachButton companyId={prospect.companyId} />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p>{prospect.fitScore}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <EvidenceLabelBadge label="INFERRED" />
                      {prospect.evidenceRelevance ? (
                        <EvidenceRelevanceBadge
                          relevance={prospect.evidenceRelevance}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p>{prospect.rationale}</p>
                    <div className="mt-1">
                      <EvidenceLabelBadge label="INFERRED" />
                    </div>
                    {prospect.signals.length > 0 ? (
                      <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                        {prospect.signals.map((signal) => (
                          <li key={`${signal.sourceUrl}-${signal.summary}`}>
                            {signal.summary}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ul className="grid gap-1">
                      {uniqueSources(prospect.claims).map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                <li key={`${category.category}-${category.sourceUrl}`}>
                  <Card>
                    <CardContent className="p-4 text-sm">
                      <p className="font-medium">{category.category}</p>
                      {category.examples.length > 0 ? (
                        <p className="mt-1 text-muted-foreground">
                          {category.examples.join(", ")}
                        </p>
                      ) : null}
                      <a
                        href={category.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block underline underline-offset-2"
                      >
                        {domain}
                      </a>
                    </CardContent>
                  </Card>
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
        <p className="mb-4 text-sm text-destructive">
          Product summary and at least one industry are required.
        </p>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
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
      <p className="mt-4 max-w-2xl text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">Loading runs…</p>
          }
        >
          <ProspectsBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
