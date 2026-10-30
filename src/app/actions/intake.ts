"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { isDomainError } from "@/domain";
import { isLlmError } from "@/lib/llm";
import { createIcpLlmClient } from "@/lib/icp/infer";
import { submitProductIntake } from "@/lib/icp/service";
import { demoActionRateLimit } from "@/lib/demo-rate-limit";
import { getPageAuth } from "@/lib/session";

export type IntakeState = { error?: string };

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitIntakeAction(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const auth = await getPageAuth();
  if (!auth) {
    redirect("/login");
  }

  const limited = await demoActionRateLimit("intake");
  if (limited) {
    return limited;
  }

  try {
    const db = await getDb();
    const { client } = createIcpLlmClient();
    const result = await submitProductIntake(
      db,
      {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        features: splitList(formData.get("features")),
        capabilities: splitList(formData.get("capabilities")),
        technicalConstraints: splitList(formData.get("technicalConstraints")),
        existingCustomers: splitList(formData.get("existingCustomers")),
        referenceWins: splitList(formData.get("referenceWins")),
        pricingModel: String(formData.get("pricingModel") ?? "").trim() || null,
        contractValueMin: optionalNumber(formData.get("contractValueMin")),
        contractValueMax: optionalNumber(formData.get("contractValueMax")),
        monetizationModel:
          String(formData.get("monetizationModel") ?? "").trim() || null,
        freeText: String(formData.get("freeText") ?? "").trim() || undefined,
      },
      auth,
      client,
    );
    redirect(`/icp/${result.icp.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    if (isDomainError(error) || isLlmError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}
