import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Review and approve inferred buyer profiles, then find prospects.
      </p>
      {icps.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="p-5 text-sm text-muted-foreground">
            No ICPs yet. Start at{" "}
            <Link href="/intake" className="underline">
              Intake
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border bg-card">
          {icps.map((icp) => (
            <li key={icp.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/icp/${icp.id}`} className="flex-1 font-medium hover:underline">
                {icp.name}
              </Link>
              <Badge variant="outline">
                {icp.status} · v{icp.version}
              </Badge>
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
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading ICPs…</p>}>
        <IcpIndexBody />
      </Suspense>
    </AppShell>
  );
}
