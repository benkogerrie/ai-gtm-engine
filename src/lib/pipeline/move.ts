import { DomainError, type MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import { getCompanyForOrg, listAuditEvents, withAudit } from "@/db/repository";
import {
  allowedPipelineMoves,
  isManualPipelineStage,
  parseManualStageMove,
  PIPELINE_STAGE_MOVE_ACTION,
  type PipelineRecords,
  type PipelineStage,
} from "./stages";

export async function movePipelineCard(
  db: AppDatabase,
  input: {
    companyId: string;
    stage: PipelineStage;
    records: PipelineRecords;
  },
  ctx: { orgId: string; actor: MutationActor },
) {
  if (ctx.actor.actorType !== "human") {
    throw new DomainError(
      "HUMAN_ACTOR_REQUIRED",
      "Pipeline card moves require an authenticated human actor",
    );
  }

  const company = await getCompanyForOrg(db, input.companyId, ctx.orgId);
  if (!company) {
    throw new DomainError("ENTITY_NOT_FOUND", "Company was not found for this org");
  }

  const allowed = allowedPipelineMoves(input.records);
  if (!allowed.includes(input.stage)) {
    throw new DomainError(
      "PIPELINE_STAGE_UNAVAILABLE",
      `Cannot move to ${input.stage} without a real record for that stage`,
    );
  }

  const after = {
    companyId: company.id,
    stage: input.stage,
    source: isManualPipelineStage(input.stage) ? "manual" : "derived",
    actorId: ctx.actor.actorId,
    at: new Date().toISOString(),
  };

  return withAudit(
    db,
    {
      orgId: ctx.orgId,
      actor: ctx.actor,
      action: PIPELINE_STAGE_MOVE_ACTION,
      entityType: "company",
      entityId: company.id,
      after,
    },
    async () => after,
  );
}

export async function latestManualStageForCompany(
  db: AppDatabase,
  orgId: string,
  companyId: string,
) {
  const events = await listAuditEvents(db, {
    orgId,
    entityType: "company",
    entityId: companyId,
    limit: 40,
  });
  for (const event of events) {
    const parsed = parseManualStageMove(event);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}
