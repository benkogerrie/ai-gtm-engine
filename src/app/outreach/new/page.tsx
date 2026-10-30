import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftOutreachForm } from "@/components/draft-outreach-form";
import { getDb } from "@/db/client";
import { uuidSchema } from "@/domain";
import { collectCitedSignals, SELLER_PRODUCT } from "@/lib/outreach";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function NewOutreachBody({ companyId }: { companyId: string | undefined }) {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    const dest = companyId
      ? `/outreach/new?companyId=${encodeURIComponent(companyId)}`
      : "/outreach/new";
    redirect(`/login?next=${encodeURIComponent(dest)}`);
  }

  if (!companyId || !uuidSchema.safeParse(companyId).success) {
    return (
      <AppShell eyebrow="B008 · Draft outreach" showLogout>
        <h1 className="font-serif text-4xl tracking-tight">Draft outreach</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          This entry point takes a company id so /prospects can link here later
          (`/outreach/new?companyId=`). Seed the TEST hospital on{" "}
          <Link href="/outreach" className="underline">
            /outreach
          </Link>{" "}
          first.
        </p>
      </AppShell>
    );
  }

  const db = await getDb();
  let collected;
  try {
    collected = await collectCitedSignals(db, companyId, auth.orgId);
  } catch {
    notFound();
  }

  return (
    <AppShell eyebrow="B008 · Draft outreach" showLogout>
      <h1 className="font-serif text-4xl tracking-tight">Draft outreach</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {SELLER_PRODUCT.name} ({SELLER_PRODUCT.description}) → {collected.companyName}.
        Drafts stay gated: approve / edit / reject, then dry-run only.
      </p>
      <p className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <Link href="/prospects" className="underline">
          Back to prospects
        </Link>
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>
      </p>
      <DraftOutreachForm
        companyId={companyId}
        companyName={collected.companyName}
        citedCount={collected.cited.length}
      />
    </AppShell>
  );
}

export default async function NewOutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <NewOutreachBody companyId={params.companyId} />
    </Suspense>
  );
}
