import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import {
  approveOutreachAction,
  regenerateOutreachAction,
  rejectOutreachAction,
  saveOutreachEditAction,
  sendDryRunAction,
} from "@/app/actions/outreach";
import { AppShell } from "@/components/app-shell";
import { OutreachDetail } from "@/components/outreach-detail";
import { getDb } from "@/db/client";
import { isDomainError } from "@/domain";
import { loadOutreachView } from "@/lib/outreach";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function OutreachDetailBody({ id }: { id: string }) {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=/outreach/${id}`);
  }

  const db = await getDb();
  let view;
  try {
    view = await loadOutreachView(db, id, auth.orgId);
  } catch (error) {
    if (isDomainError(error) && error.code === "OUTREACH_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <AppShell eyebrow="B008 · Outreach review" showLogout>
      <OutreachDetail
        view={{
          ...view,
          createdAt: view.createdAt.toISOString(),
          updatedAt: view.updatedAt.toISOString(),
          sentAt: view.sentAt ? view.sentAt.toISOString() : null,
        }}
        onSave={saveOutreachEditAction}
        onRegenerate={regenerateOutreachAction}
        onApprove={approveOutreachAction}
        onReject={rejectOutreachAction}
        onDryRun={sendDryRunAction}
      />
    </AppShell>
  );
}

export default async function OutreachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <OutreachDetailBody id={id} />
    </Suspense>
  );
}
