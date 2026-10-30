"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  isDomainError,
  type ExpansionDecision,
  type IcpFieldEdit,
} from "@/domain";
import {
  approveIcp,
  decideExpansion,
  editIcpFields,
} from "@/lib/icp/service";
import { getPageAuth } from "@/lib/session";

export type IcpActionState = { error?: string; nextId?: string };

async function requireAuth() {
  const auth = await getPageAuth();
  if (!auth) {
    redirect("/login");
  }
  return auth;
}

export async function approveIcpAction(icpId: string): Promise<IcpActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await approveIcp(db, icpId, auth);
    revalidatePath(`/icp/${icpId}`);
    return {};
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function decideExpansionAction(input: {
  icpId: string;
  suggestionId: string;
  decision: Exclude<ExpansionDecision, "PENDING">;
  note?: string;
}): Promise<IcpActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await decideExpansion(db, input, auth);
    revalidatePath(`/icp/${input.icpId}`);
    return {};
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function saveIcpEditsAction(
  icpId: string,
  edit: IcpFieldEdit,
): Promise<IcpActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    const next = await editIcpFields(db, icpId, edit, auth);
    revalidatePath(`/icp/${icpId}`);
    if (next.id !== icpId) {
      redirect(`/icp/${next.id}`);
    }
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
