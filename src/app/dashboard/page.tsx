import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { EvidenceLabelBadge, EvidenceLegend } from "@/components/evidence-label";
import { getDb } from "@/db/client";
import { loadDashboard } from "@/lib/pipeline";
import { getPageAuth } from "@/lib/session";
import { DashboardBoard } from "./dashboard-board";

export const instant = false;

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
      <label className="block text-sm">
        <span className="text-[var(--muted)]">ICP</span>
        <select
          name="icp"
          defaultValue={snapshotIcpId ?? ""}
          className="mt-1 rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
        >
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
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">Discovery run</span>
        <select
          name="run"
          defaultValue={snapshotRunId ?? ""}
          className="mt-1 rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
        >
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
      </label>
      <button
        type="submit"
        className="rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
      >
        Show
      </button>
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
        <p className="mt-3 text-sm text-[var(--muted)]">
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
        <p className="mt-3 text-sm text-[var(--muted)]">
          Approve an ICP on <Link href="/intake" className="underline">Intake</Link>{" "}
          first, then discover prospects.
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-2xl tracking-tight">Prospects</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          One row per organization. Fit score is INFERRED. Cited facts are VERIFIED.
        </p>
        <div className="mt-3">
          <EvidenceLegend />
        </div>
        {snapshot.cards.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
            No cited prospects for this ICP yet. Run discovery from{" "}
            <Link href="/prospects" className="underline">
              Prospects
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--rule)] bg-[var(--card)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--rule)] text-xs tracking-wide text-[var(--muted)] uppercase">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Fit</th>
                  <th className="px-4 py-3">Explanation</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Stage</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.cards.map((card) => (
                  <tr
                    key={card.companyId}
                    className="border-b border-[var(--rule)] last:border-b-0 align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{card.name}</p>
                      {card.domain ? (
                        <p className="text-xs text-[var(--muted)]">{card.domain}</p>
                      ) : null}
                      <div className="mt-2">
                        <DraftOutreachButton companyId={card.companyId} />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p>{card.fitScore ?? "—"}</p>
                      <EvidenceLabelBadge label="INFERRED" />
                      {card.evidenceRelevance ? (
                        <p className="mt-1 text-[10px] tracking-wide text-[var(--muted)] uppercase">
                          {card.evidenceRelevance} evidence
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{card.rationale}</p>
                      <div className="mt-1">
                        <EvidenceLabelBadge label="INFERRED" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="grid gap-1">
                        {card.evidence.map((item) => (
                          <li key={item.url}>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-[var(--rule)] underline-offset-2"
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
                    </td>
                    <td className="px-4 py-3 text-xs uppercase">
                      {card.stage.replaceAll("_", " ")}
                      {card.stageSource === "manual" ? " · manual" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight">Pipeline</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
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
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        ShiftPilot → ICP → cited prospects → outreach → approval → dry-run. One
        board, real records only.
      </p>
      <div className="mt-10">
        <Suspense
          fallback={<p className="text-sm text-[var(--muted)]">Loading dashboard…</p>}
        >
          <DashboardBody searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
