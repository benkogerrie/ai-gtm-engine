import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { ViewInGraphLink } from "@/components/view-in-graph-link";
import {
  EvidenceLabelBadge,
  EvidenceLegend,
  EvidenceRelevanceBadge,
} from "@/components/evidence-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { DashboardBoard } from "./dashboard-board";

export const instant = false;

const selectClass =
  "mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function IcpPicker({
  snapshotIcpId,
  snapshotRunId,
  icps,
  runs,
}: {
  snapshotIcpId: string | undefined;
  snapshotRunId: string | undefined;
  icps: Array<{ id: string; name: string; status: string }>;
  runs: Array<{ id: string; status: string; updatedAt: string; prospectCount: number }>;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <Label>
        <span className="text-muted-foreground">ICP</span>
        <select name="icp" defaultValue={snapshotIcpId ?? ""} className={selectClass}>
          {icps.length === 0 ? (
            <option value="">No ICPs yet</option>
          ) : (
            icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name} · {icp.status}
              </option>
            ))
          )}
        </select>
      </Label>
      <Label>
        <span className="text-muted-foreground">Discovery run</span>
        <select name="run" defaultValue={snapshotRunId ?? ""} className={selectClass}>
          {runs.length === 0 ? (
            <option value="">No completed runs</option>
          ) : (
            runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.slice(0, 8)} · {run.status} · {run.prospectCount} orgs ·{" "}
                {new Date(run.updatedAt).toLocaleString()}
              </option>
            ))
          )}
        </select>
      </Label>
      <Button type="submit" variant="outline">
        Show
      </Button>
    </form>
  );
}

async function DashboardBody({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const nextParams = new URLSearchParams();
  if (params.icp) {
    nextParams.set("icp", params.icp);
  }
  if (params.run) {
    nextParams.set("run", params.run);
  }
  const next = nextParams.size
    ? `/dashboard?${nextParams.toString()}`
    : "/dashboard";
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const db = await getDb();
  const snapshot = await loadDashboard(db, auth.orgId, {
    icpId: params.icp,
    runId: params.run,
  });

  return (
    <>
      <IcpPicker
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
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <DraftOutreachButton companyId={card.companyId} />
                        <ViewInGraphLink
                          icpId={snapshot.icp?.id}
                          runId={snapshot.run?.id}
                          prospectId={card.companyId}
                        />
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

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight">Pipeline</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Stages come from recorded data only. Later stages are human moves labeled
          manual — no fabricated replies or sends.
        </p>
        <div className="mt-6">
          <DashboardBoard snapshot={snapshot} />
        </div>
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
    <AppShell eyebrow="B009 · Pipeline" showLogout wide>
      <h1 className="font-serif text-4xl tracking-tight">Dashboard</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        ShiftPilot → ICP → cited prospects → outreach → approval → dry-run. One
        board, real records only.
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
