import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardBoard } from "@/app/dashboard/dashboard-board";
import { AppShell } from "@/components/app-shell";
import { IcpRunPicker } from "@/components/icp-run-picker";
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

async function PipelineBody({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const next = withQuery("/pipeline", params);
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
      <p className="mt-2 text-sm text-muted-foreground">
        <Link
          href={withQuery("/dashboard", {
            icp: snapshot.icp?.id,
            run: snapshot.run?.id,
          })}
          className="underline"
        >
          Back to dashboard
        </Link>
      </p>
      <div className="mt-6">
        <DashboardBoard snapshot={snapshot} />
      </div>
    </>
  );
}

export default function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ icp?: string; run?: string }>;
}) {
  return (
    <AppShell eyebrow="B009 · Pipeline" showLogout wide>
      <h1 className="font-serif text-4xl tracking-tight">Pipeline</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Stages come from recorded data only. Later stages are human moves labeled
        manual — no fabricated replies or sends.
      </p>
      <div className="mt-10">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading pipeline…</p>}
        >
          <PipelineBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
