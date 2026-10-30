import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EvidenceLegend } from "@/components/evidence-label";
import { getDb } from "@/db/client";
import { loadGraph } from "@/lib/graph";
import { getPageAuth } from "@/lib/session";
import { GraphView } from "./graph-view";

export const instant = false;

const selectClass =
  "mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RunPicker({
  snapshotIcpId,
  snapshotRunId,
  icps,
  runs,
}: {
  snapshotIcpId: string | undefined;
  snapshotRunId: string | undefined;
  icps: Array<{ id: string; name: string; status: string }>;
  runs: Array<{
    id: string;
    status: string;
    mode: string;
    updatedAt: string;
    prospectCount: number;
  }>;
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
                {run.id.slice(0, 8)} · {run.mode} · {run.prospectCount} orgs ·{" "}
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

function EmptyCopy({ reason }: { reason: string | null }) {
  if (reason === "no-icp") {
    return (
      <>
        Approve an ICP on{" "}
        <Link href="/intake" className="underline">
          Intake
        </Link>{" "}
        first, then discover prospects.
      </>
    );
  }
  if (reason === "no-run") {
    return (
      <>
        No completed discovery run for this ICP. Run discovery from{" "}
        <Link href="/prospects" className="underline">
          Prospects
        </Link>
        .
      </>
    );
  }
  if (reason === "mock-empty") {
    return (
      <>
        MOCK run: synthetic search hits are never stored as citations, so no
        fabricated companies are shown. Add BRAVE_SEARCH_API_KEY and
        DEEPSEEK_API_KEY for a live run, or open a completed LIVE run.
      </>
    );
  }
  if (reason === "no-prospects") {
    return (
      <>
        No cited buyer organizations survived validation for this run. The graph
        only includes nodes derived from stored records.
      </>
    );
  }
  return <>No graph data for this selection.</>;
}

async function GraphBody({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string; prospect?: string }>;
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
  if (params.prospect) {
    nextParams.set("prospect", params.prospect);
  }
  const next = nextParams.size ? `/graph?${nextParams.toString()}` : "/graph";
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const db = await getDb();
  const snapshot = await loadGraph(db, auth.orgId, {
    icpId: params.icp,
    runId: params.run,
  });

  return (
    <>
      <RunPicker
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
          </Link>
          {snapshot.sellerName ? ` · seller ${snapshot.sellerName}` : ""}
          {snapshot.run
            ? ` · run ${snapshot.run.id.slice(0, 8)} (${snapshot.run.mode}, ${snapshot.run.status}, ${snapshot.run.prospectCount} orgs)`
            : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <EmptyCopy reason={snapshot.emptyReason} />
        </p>
      )}

      {snapshot.mock ? (
        <p className="mt-4 rounded-md border border-border bg-accent px-3 py-2 text-sm text-accent-foreground">
          MOCK output. This graph is derived only from stored MOCK-run records.
          It is not live evidence. VERIFIED still means a retrieved cited
          source URL — not independently verified.
        </p>
      ) : null}

      {snapshot.emptyReason && snapshot.graph.nodes.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-5 text-sm text-muted-foreground">
            <EmptyCopy reason={snapshot.emptyReason} />
          </CardContent>
        </Card>
      ) : snapshot.emptyReason && snapshot.graph.nodes.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-5 text-sm text-muted-foreground">
            <EmptyCopy reason={snapshot.emptyReason} />
          </CardContent>
        </Card>
      ) : null}

      {snapshot.graph.nodes.length > 0 ? (
        <GraphView snapshot={snapshot} initialProspectId={params.prospect} />
      ) : null}
    </>
  );
}

export default function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string; prospect?: string }>;
}) {
  return (
    <AppShell eyebrow="B014 · Knowledge graph" showLogout wide full>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Graph</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Automated path matching from seller and ICP to cited prospects.
            Edges are derived from stored records only. VERIFIED means a
            retrieved cited source URL — not independently verified.
          </p>
        </div>
        <Badge variant="outline">Dijkstra</Badge>
      </div>
      <div className="mt-4">
        <EvidenceLegend />
      </div>
      <div className="mt-8">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading graph…</p>}
        >
          <GraphBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
