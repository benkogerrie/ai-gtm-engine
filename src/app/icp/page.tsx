import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDb } from "@/db/client";
import { listIcpsForOrg } from "@/db/repository";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function IcpIndexBody() {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    redirect("/login?next=/icp");
  }

  const db = await getDb();
  const icps = await listIcpsForOrg(db, auth.orgId);

  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">ICP</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Review and approve inferred buyer profiles, then find prospects.
      </p>
      {icps.length === 0 ? (
        <p className="mt-8 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
          No ICPs yet. Start at{" "}
          <Link href="/intake" className="underline">
            Intake
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--rule)] rounded-lg border border-[var(--rule)] bg-[var(--card)]">
          {icps.map((icp) => (
            <li key={icp.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/icp/${icp.id}`} className="flex-1 font-medium hover:underline">
                {icp.name}
              </Link>
              <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
                {icp.status} · v{icp.version}
              </span>
              {icp.status === "APPROVED" ? (
                <Link
                  href={`/prospects?icp=${icp.id}`}
                  className="text-xs underline"
                >
                  Prospects
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function IcpIndexPage() {
  return (
    <AppShell eyebrow="B003 · ICP" showLogout>
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading ICPs…</p>}>
        <IcpIndexBody />
      </Suspense>
    </AppShell>
  );
}
