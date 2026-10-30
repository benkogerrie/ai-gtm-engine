"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isDomainError } from "@/domain";
import { loadDashboard, movePipelineCard, isPipelineStage } from "@/lib/pipeline";
import { getPageAuth } from "@/lib/session";

export type DashboardActionState = { error?: string };

async function requireAuth(next = "/dashboard") {
  const auth = await getPageAuth();
  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return auth;
}

export async function moveDashboardCardAction(
  _prev: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const icpId = String(formData.get("icpId") ?? "").trim();
  const next = icpId ? `/dashboard?icp=${encodeURIComponent(icpId)}` : "/dashboard";
  const auth = await requireAuth(next);
  const companyId = String(formData.get("companyId") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  if (!companyId || !isPipelineStage(stageRaw)) {
    return { error: "Choose a company and a valid pipeline stage." };
  }

  try {
    const db = await getDb();
    const snapshot = await loadDashboard(db, auth.orgId, icpId || undefined);
    const card = snapshot.cards.find((item) => item.companyId === companyId);
    if (!card) {
      return { error: "That prospect is not on this dashboard." };
    }
    await movePipelineCard(
      db,
      {
        companyId,
        stage: stageRaw,
        records: {
          prospectExists: true,
          hasDraft: card.allowedMoves.includes("DRAFTED"),
          hasApproved: card.allowedMoves.includes("APPROVED"),
          hasDryRunCompletedAudit: card.allowedMoves.includes("DRY_RUN_SENT"),
          hasRejected: card.allowedMoves.includes("REJECTED"),
        },
      },
      auth,
    );
    revalidatePath("/dashboard");
    return {};
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}
