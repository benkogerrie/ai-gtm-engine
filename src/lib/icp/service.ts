import {
  assertIcpTransition,
  DomainError,
  productIntakeSchema,
  structuredIcpSchema,
  type ExpansionDecision,
  type IcpFieldEdit,
  type MutationActor,
  type ProductIntake,
  type StructuredIcp,
} from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  createFieldAssertion,
  createIcp,
  createProduct,
  ensureOrganization,
  getIcpForOrg,
  getProduct,
  updateIcp,
} from "@/db/repository";
import { flattenStructuredIcp, inferStructuredIcp } from "./infer";
import type { LlmClient } from "@/lib/llm";

const ICP_ASSERTED_FIELDS = [
  "targetIndustries",
  "companySize",
  "buyerPersonas",
  "triggerEvents",
  "expansionSuggestions",
] as const;

function asStructured(value: unknown): StructuredIcp | null {
  const parsed = structuredIcpSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function submitProductIntake(
  db: AppDatabase,
  raw: ProductIntake,
  ctx: { orgId: string; actor: MutationActor },
  client: LlmClient,
) {
  const intake = productIntakeSchema.parse(raw);
  await ensureOrganization(
    db,
    { id: ctx.orgId, name: "Workspace" },
    ctx.actor,
  );

  const existingCustomers = [
    ...(intake.existingCustomers ?? []),
    ...(intake.referenceWins ?? []),
  ];
  const description = intake.freeText?.trim()
    ? `${intake.description}\n\n${intake.freeText.trim()}`
    : intake.description;

  const product = await createProduct(
    db,
    {
      orgId: ctx.orgId,
      name: intake.name,
      description,
      features: intake.features ?? [],
      capabilities: intake.capabilities ?? [],
      technicalConstraints: intake.technicalConstraints ?? [],
      existingCustomers,
      pricingModel: intake.pricingModel ?? null,
      contractValueMin: intake.contractValueMin ?? null,
      contractValueMax: intake.contractValueMax ?? null,
      monetizationModel: intake.monetizationModel ?? null,
    },
    ctx.actor,
  );

  const inferred = await inferStructuredIcp(client, intake);
  const flat = flattenStructuredIcp(inferred.structured);

  const icp = await createIcp(
    db,
    {
      orgId: ctx.orgId,
      productId: product.id,
      status: "DRAFT",
      ...flat,
      inferenceMode: inferred.inferenceMode,
      structured: inferred.structured,
    },
    ctx.actor,
  );

  for (const fieldName of ICP_ASSERTED_FIELDS) {
    await createFieldAssertion(
      db,
      {
        orgId: ctx.orgId,
        entityType: "icp",
        entityId: icp.id,
        fieldName,
        fieldValue:
          fieldName === "companySize"
            ? inferred.structured.companySize
            : inferred.structured[fieldName],
        verificationStatus: "INFERRED",
        assertedBy: "agent",
      },
      ctx.actor,
    );
  }

  return { product, icp, structured: inferred.structured };
}

export async function loadIcpForOrg(
  db: AppDatabase,
  icpId: string,
  orgId: string,
) {
  const icp = await getIcpForOrg(db, icpId, orgId);
  if (!icp) {
    return null;
  }
  const product = await getProduct(db, icp.productId);
  if (!product || product.orgId !== orgId) {
    return null;
  }
  return { icp, product, structured: asStructured(icp.structured) };
}

export async function approveIcp(
  db: AppDatabase,
  icpId: string,
  ctx: { orgId: string; actor: MutationActor },
) {
  const icp = await getIcpForOrg(db, icpId, ctx.orgId);
  if (!icp) {
    throw new DomainError("ICP_NOT_FOUND", "ICP not found");
  }
  assertIcpTransition(icp.status, "APPROVED");
  return updateIcp(
    db,
    icp.id,
    ctx.orgId,
    {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: ctx.actor.actorId,
    },
    ctx.actor,
    "icp.approve",
  );
}

export async function decideExpansion(
  db: AppDatabase,
  input: {
    icpId: string;
    suggestionId: string;
    decision: Exclude<ExpansionDecision, "PENDING">;
    note?: string;
  },
  ctx: { orgId: string; actor: MutationActor },
) {
  const icp = await getIcpForOrg(db, input.icpId, ctx.orgId);
  if (!icp) {
    throw new DomainError("ICP_NOT_FOUND", "ICP not found");
  }
  const structured = asStructured(icp.structured);
  if (!structured) {
    throw new DomainError("ICP_INFERENCE_INVALID", "ICP has no structured payload");
  }
  const index = structured.expansionSuggestions.findIndex(
    (item) => item.id === input.suggestionId,
  );
  if (index < 0) {
    throw new DomainError("EXPANSION_NOT_FOUND", "Expansion suggestion not found");
  }

  const nextStructured: StructuredIcp = {
    ...structured,
    expansionSuggestions: structured.expansionSuggestions.map((item, i) =>
      i === index
        ? {
            ...item,
            decision: input.decision,
            decisionNote: input.note ?? item.decisionNote,
            decidedBy: ctx.actor.actorId,
            decidedAt: new Date(),
          }
        : item,
    ),
  };

  return updateIcp(
    db,
    icp.id,
    ctx.orgId,
    { structured: nextStructured },
    ctx.actor,
    `icp.expansion.${input.decision.toLowerCase()}`,
  );
}

export async function editIcpFields(
  db: AppDatabase,
  icpId: string,
  edit: IcpFieldEdit,
  ctx: { orgId: string; actor: MutationActor },
) {
  const icp = await getIcpForOrg(db, icpId, ctx.orgId);
  if (!icp) {
    throw new DomainError("ICP_NOT_FOUND", "ICP not found");
  }
  const current = asStructured(icp.structured);
  if (!current) {
    throw new DomainError("ICP_INFERENCE_INVALID", "ICP has no structured payload");
  }

  const nextStructured: StructuredIcp = structuredIcpSchema.parse({
    ...current,
    ...edit,
    name: edit.name ?? current.name,
  });
  const flat = flattenStructuredIcp(nextStructured);

  if (icp.status === "APPROVED") {
    assertIcpTransition(icp.status, "DRAFT");
    return createIcp(
      db,
      {
        orgId: ctx.orgId,
        productId: icp.productId,
        status: "DRAFT",
        version: icp.version + 1,
        parentIcpId: icp.id,
        inferenceMode: icp.inferenceMode === "live" ? "live" : "mock",
        structured: nextStructured,
        ...flat,
      },
      ctx.actor,
    );
  }

  return updateIcp(
    db,
    icp.id,
    ctx.orgId,
    { ...flat, structured: nextStructured },
    ctx.actor,
  );
}
