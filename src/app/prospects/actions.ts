"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { uuidSchema } from "@/domain";
import {
  discoveryInputFromIcp,
  discoveryInputSchema,
  getDiscoveryPageAuth,
  runDiscovery,
} from "@/lib/discovery";
import { loadIcpForOrg } from "@/lib/icp/service";

function csv(value: FormDataEntryValue | null): string[] | undefined {
  const text = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return text.length ? text : undefined;
}

export async function startDiscoveryAction(formData: FormData) {
  const auth = await getDiscoveryPageAuth();
  if (!auth) {
    redirect("/login?next=/prospects");
  }

  const icpId = String(formData.get("icpId") ?? "").trim();
  const parsed = discoveryInputSchema.safeParse({
    productSummary: String(formData.get("productSummary") ?? "").trim(),
    industries: csv(formData.get("industries")) ?? [],
    geographies: csv(formData.get("geography")),
    companySizes: csv(formData.get("companySizes")),
    personas: csv(formData.get("personas")),
    triggers: csv(formData.get("triggers")),
    excludeDomains: csv(formData.get("excludeDomains")),
    icpId: uuidSchema.safeParse(icpId).success ? icpId : undefined,
  });

  if (!parsed.success) {
    redirect("/prospects?error=invalid");
  }

  const db = await getDb();
  const run = await runDiscovery(parsed.data, {
    db,
    orgId: auth.orgId,
    actor: auth.actor,
  });

  const next = new URLSearchParams({ runId: run.id });
  if (parsed.data.icpId) {
    next.set("icp", parsed.data.icpId);
  }
  redirect(`/prospects?${next.toString()}`);
}

export async function startDiscoveryFromIcpAction(icpId: string) {
  const auth = await getDiscoveryPageAuth();
  if (!auth) {
    redirect(`/login?next=/icp/${icpId}`);
  }

  const db = await getDb();
  const loaded = await loadIcpForOrg(db, icpId, auth.orgId);
  if (!loaded || !loaded.structured) {
    redirect(`/icp/${icpId}`);
  }
  if (loaded.icp.status !== "APPROVED") {
    redirect(`/icp/${icpId}`);
  }

  const input = discoveryInputFromIcp({
    icpId: loaded.icp.id,
    productSummary: loaded.product.description,
    structured: loaded.structured,
  });

  const run = await runDiscovery(input, {
    db,
    orgId: auth.orgId,
    actor: auth.actor,
  });

  redirect(`/prospects?icp=${loaded.icp.id}&runId=${run.id}`);
}
