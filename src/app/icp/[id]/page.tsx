import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import {
  approveIcpAction,
  decideExpansionAction,
  saveIcpEditsAction,
} from "@/app/actions/icp";
import { AppShell } from "@/components/app-shell";
import { IcpReviewScreen } from "@/components/icp-review-screen";
import { getDb } from "@/db/client";
import { loadIcpForOrg } from "@/lib/icp/service";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function IcpBody({ id }: { id: string }) {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=/icp/${id}`);
  }

  const db = await getDb();
  const loaded = await loadIcpForOrg(db, id, auth.orgId);
  if (!loaded || !loaded.structured) {
    notFound();
  }

  return (
    <AppShell eyebrow="B003 · ICP review" showLogout>
      <IcpReviewScreen
        icp={{
          id: loaded.icp.id,
          name: loaded.icp.name,
          status: loaded.icp.status,
          version: loaded.icp.version,
          inferenceMode: loaded.icp.inferenceMode,
          structured: loaded.structured,
        }}
        productName={loaded.product.name}
        onApprove={approveIcpAction}
        onDecide={decideExpansionAction}
        onSave={saveIcpEditsAction}
      />
    </AppShell>
  );
}

export default async function IcpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--muted)]">Loading…</p>}>
      <IcpBody id={id} />
    </Suspense>
  );
}
