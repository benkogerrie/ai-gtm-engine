import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import {
  EvidenceLabelBadge,
  EvidenceLegend,
  EvidenceRelevanceBadge,
} from "@/components/evidence-label";
import { IcpRunPicker } from "@/components/icp-run-picker";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db/client";
import { loadDashboard } from "@/lib/pipeline";
import { getPageAuth } from "@/lib/session";

export const instant = false;

function withQuery(path: string, params: { icp?: string; run?: string }): string {
  const nextParams = new URLSearchParams();
  if (params.icp) {
    nextParams.set("icp", params.icp);
  }
  if (params.run) {
    nextParams.set("run", params.run);
  }
  return nextParams.size ? `${path}?${nextParams.toString()}` : path;
}

async function DashboardBody({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const next = withQuery("/dashboard", params);
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const db = await getDb();
  const snapshot = await loadDashboard(db, auth.orgId, {
    icpId: params.icp,
    runId: params.run,
  });
  const pipelineHref = withQuery("/pipeline", {
    icp: snapshot.icp?.id,
    run: snapshot.run?.id,
  });

  return (
    <>
      <IcpRunPicker
        snapshotIcpId={snapshot.icp?.id}
        snapshotRunId={snapshot.run?.id}
        icps={snapshot.icps}
        runs={snapshot.runs}
      />
      {snapshot.icp ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing{" "}
          <Link href={`/icp/${snapshot.icp.id}`} className="underline">
            {snapshot.icp.name}
          </Link>{" "}
          · {snapshot.icp.status}
          {snapshot.run
            ? ` · run ${snapshot.run.id.slice(0, 8)} (${snapshot.run.status}, ${new Date(snapshot.run.updatedAt).toLocaleString()}, ${snapshot.run.prospectCount} orgs)`
            : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Approve an ICP on <Link href="/intake" className="underline">Intake</Link>{" "}
          first, then discover prospects.
        </p>
      )}

      <p className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Organizations:{" "}
          <span className="text-foreground">{snapshot.cards.length}</span>
        </span>
        <span>
          Email drafts:{" "}
          <span className="text-foreground">{snapshot.channelCounts.email}</span>
        </span>
        <span>
          LinkedIn drafts:{" "}
          <span className="text-foreground">{snapshot.channelCounts.linkedin}</span>
        </span>
        <Link href={pipelineHref} className="underline">
          Open pipeline
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="font-serif text-2xl tracking-tight">Prospects</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One row per organization. Fit score is INFERRED. Cited facts are VERIFIED.
        </p>
        <div className="mt-3">
          <EvidenceLegend />
        </div>
        {snapshot.cards.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="p-5 text-sm text-muted-foreground">
              No cited prospects for this ICP yet. Run discovery from{" "}
              <Link href="/prospects" className="underline">
                Prospects
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Fit</TableHead>
                  <TableHead>Explanation</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.cards.map((card) => (
                  <TableRow key={card.companyId}>
                    <TableCell>
                      <p className="font-medium">{card.name}</p>
                      {card.domain ? (
                        <p className="text-xs text-muted-foreground">{card.domain}</p>
                      ) : null}
                      <div className="mt-2">
                        <DraftOutreachButton companyId={card.companyId} />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p>{card.fitScore ?? "—"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <EvidenceLabelBadge label="INFERRED" />
                        {card.evidenceRelevance ? (
                          <EvidenceRelevanceBadge
                            relevance={card.evidenceRelevance}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p>{card.rationale}</p>
                      <div className="mt-1">
                        <EvidenceLabelBadge label="INFERRED" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <ul className="grid gap-1">
                        {card.evidence.map((item) => (
                          <li key={item.url}>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              {item.title}
                              {item.domain && item.title !== item.domain
                                ? ` · ${item.domain}`
                                : ""}
                            </a>{" "}
                            <EvidenceLabelBadge label={item.label} />
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-xs uppercase">
                      {card.stage.replaceAll("_", " ")}
                      {card.stageSource === "manual" ? " · manual" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string }>;
}) {
  return (
    <AppShell eyebrow="B009 · Dashboard" showLogout wide>
      <h1 className="font-serif text-4xl tracking-tight">Dashboard</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        ShiftPilot → ICP → cited prospects → outreach → approval → dry-run.
        Real records only.
      </p>
      <div className="mt-10">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading dashboard…</p>}
        >
          <DashboardBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
