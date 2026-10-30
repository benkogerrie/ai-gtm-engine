"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isDomainError } from "@/domain";
import { isLlmError } from "@/lib/llm";
import {
  approveOutreachDraft,
  draftOutreachForCompany,
  editOutreachDraft,
  outreachCtaSchema,
  outreachToneSchema,
  regenerateOutreach,
  rejectOutreachDraft,
  seedDemoCompany,
  sendOutreachDryRun,
} from "@/lib/outreach";
import { getPageAuth } from "@/lib/session";

export type OutreachActionState = { error?: string; nextId?: string };

async function requireAuth() {
  const auth = await getPageAuth();
  if (!auth) {
    redirect("/login?next=/outreach");
  }
  return auth;
}

function asActionError(error: unknown): OutreachActionState {
  if (error && typeof error === "object" && "digest" in error) {
    throw error;
  }
  if (isDomainError(error) || isLlmError(error)) {
    return { error: error.message };
  }
  throw error;
}

export async function draftOutreachAction(
  _prev: OutreachActionState,
  formData: FormData,
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const tone = outreachToneSchema.safeParse(formData.get("tone"));
  const cta = outreachCtaSchema.safeParse(formData.get("cta"));
  if (!companyId) {
    return { error: "Choose a company id." };
  }
  if (!tone.success || !cta.success) {
    return { error: "Tone must be professional | friendly | direct. CTA must be book a call | reply | learn more." };
  }

  try {
    const db = await getDb();
    const drafted = await draftOutreachForCompany(
      db,
      { companyId, tone: tone.data, cta: cta.data },
      auth,
    );
    redirect(`/outreach/${drafted.id}`);
  } catch (error) {
    return asActionError(error);
  }
}

export async function seedDemoCompanyAction(
  prev: OutreachActionState = {},
  formData?: FormData,
): Promise<OutreachActionState> {
  void prev;
  void formData;
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await seedDemoCompany(db, auth);
    revalidatePath("/outreach");
    return {};
  } catch (error) {
    return asActionError(error);
  }
}

export async function saveOutreachEditAction(
  outreachId: string,
  input: { subject: string; body: string; linkedinMessage: string },
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    const next = await editOutreachDraft(
      db,
      { outreachId, ...input },
      auth,
    );
    revalidatePath("/outreach");
    revalidatePath(`/outreach/${outreachId}`);
    if (next.id !== outreachId) {
      redirect(`/outreach/${next.id}`);
    }
    return {};
  } catch (error) {
    return asActionError(error);
  }
}

export async function regenerateOutreachAction(
  outreachId: string,
  input: { tone: string; cta: string },
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  const tone = outreachToneSchema.safeParse(input.tone);
  const cta = outreachCtaSchema.safeParse(input.cta);
  if (!tone.success || !cta.success) {
    return { error: "Invalid tone or CTA." };
  }
  try {
    const db = await getDb();
    const next = await regenerateOutreach(
      db,
      { outreachId, tone: tone.data, cta: cta.data },
      auth,
    );
    revalidatePath("/outreach");
    revalidatePath(`/outreach/${outreachId}`);
    if (next.id !== outreachId) {
      redirect(`/outreach/${next.id}`);
    }
    return {};
  } catch (error) {
    return asActionError(error);
  }
}

export async function approveOutreachAction(
  outreachId: string,
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await approveOutreachDraft(db, outreachId, auth);
    revalidatePath("/outreach");
    revalidatePath(`/outreach/${outreachId}`);
    return {};
  } catch (error) {
    return asActionError(error);
  }
}

export async function rejectOutreachAction(
  outreachId: string,
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await rejectOutreachDraft(db, outreachId, auth);
    revalidatePath("/outreach");
    revalidatePath(`/outreach/${outreachId}`);
    return {};
  } catch (error) {
    return asActionError(error);
  }
}

export async function sendDryRunAction(
  outreachId: string,
): Promise<OutreachActionState> {
  const auth = await requireAuth();
  try {
    const db = await getDb();
    await sendOutreachDryRun(db, outreachId, auth);
    revalidatePath("/outreach");
    revalidatePath(`/outreach/${outreachId}`);
    return {};
  } catch (error) {
    return asActionError(error);
  }
}
