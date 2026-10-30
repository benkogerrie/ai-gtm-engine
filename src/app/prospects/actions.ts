"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  discoveryInputSchema,
  getDiscoveryPageAuth,
  runDiscovery,
} from "@/lib/discovery";

function csv(value: FormDataEntryValue | null): string[] | undefined {
  const text = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return text.length ? text : undefined;
}

export async function startDiscoveryAction(formData: FormData) {
  const parsed = discoveryInputSchema.safeParse({
    productSummary: String(formData.get("productSummary") ?? "").trim(),
    industries: csv(formData.get("industries")) ?? [],
    geographies: csv(formData.get("geography")),
    companySizes: csv(formData.get("companySizes")),
    personas: csv(formData.get("personas")),
    triggers: csv(formData.get("triggers")),
    excludeDomains: csv(formData.get("excludeDomains")),
  });

  if (!parsed.success) {
    redirect("/prospects?error=invalid");
  }

  const auth = getDiscoveryPageAuth();
  const db = await getDb();
  const run = await runDiscovery(parsed.data, {
    db,
    orgId: auth.orgId,
    actor: auth.actor,
  });

  redirect(`/prospects?runId=${run.id}`);
}
