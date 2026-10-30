import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OutreachList } from "@/components/outreach-list";
import { getDb } from "@/db/client";
import { listOrgCompanies, listOutreachViews } from "@/lib/outreach";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function OutreachBody({ companyId }: { companyId?: string }) {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    const dest = companyId
      ? `/outreach?companyId=${encodeURIComponent(companyId)}`
      : "/outreach";
    redirect(`/login?next=${encodeURIComponent(dest)}`);
  }

  const db = await getDb();
  const [rows, companies] = await Promise.all([
    listOutreachViews(db, auth.orgId),
    listOrgCompanies(db, auth.orgId),
  ]);

  return (
    <AppShell eyebrow="B008 · Outreach" showLogout>
      <OutreachList
        rows={rows.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          companyDomain: row.companyDomain,
          status: row.status,
          updatedAt: row.updatedAt.toISOString(),
          labeledTest: row.labeledTest,
          inferenceMode: row.inferenceMode,
        }))}
        companies={companies.map((company) => ({
          id: company.id,
          name: company.name,
          domain: company.domain,
        }))}
        selectedCompanyId={companyId}
      />
    </AppShell>
  );
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <OutreachBody companyId={params.companyId} />
    </Suspense>
  );
}
