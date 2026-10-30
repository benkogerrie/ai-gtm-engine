export const PIPELINE_STAGES = [
  "MATCHED",
  "DRAFTED",
  "APPROVED",
  "DRY_RUN_SENT",
  "REJECTED",
  "REPLIED",
  "MEETING_BOOKED",
  "CLOSED_LOST",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const AUTO_PIPELINE_STAGES = [
  "MATCHED",
  "DRAFTED",
  "APPROVED",
  "DRY_RUN_SENT",
  "REJECTED",
] as const;
export type AutoPipelineStage = (typeof AUTO_PIPELINE_STAGES)[number];

export const MANUAL_PIPELINE_STAGES = [
  "REPLIED",
  "MEETING_BOOKED",
  "CLOSED_LOST",
] as const;
export type ManualPipelineStage = (typeof MANUAL_PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_MOVE_ACTION = "pipeline.stage.move";
export const DRY_RUN_COMPLETED_STATUS = "DRY_RUN_COMPLETED";

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  MATCHED: "Matched",
  DRAFTED: "Drafted",
  APPROVED: "Approved",
  DRY_RUN_SENT: "Dry-run sent",
  REJECTED: "Rejected",
  REPLIED: "Replied",
  MEETING_BOOKED: "Meeting booked",
  CLOSED_LOST: "Closed/Lost",
};

export type PipelineRecords = {
  prospectExists: boolean;
  hasDraft: boolean;
  hasApproved: boolean;
  hasDryRunCompletedAudit: boolean;
  hasRejected: boolean;
};

export function isPipelineStage(value: unknown): value is PipelineStage {
  return (
    typeof value === "string" &&
    (PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

export function isManualPipelineStage(
  value: unknown,
): value is ManualPipelineStage {
  return (
    typeof value === "string" &&
    (MANUAL_PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

export function isAutoPipelineStage(value: unknown): value is AutoPipelineStage {
  return (
    typeof value === "string" &&
    (AUTO_PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

/**
 * Derive the automatic board stage from recorded rows / audit only.
 * Returns null when no prospect exists — no fabricated stage.
 */
export function deriveAutoStage(records: PipelineRecords): AutoPipelineStage | null {
  if (!records.prospectExists) {
    return null;
  }
  if (records.hasDryRunCompletedAudit) {
    return "DRY_RUN_SENT";
  }
  if (records.hasApproved) {
    return "APPROVED";
  }
  if (records.hasDraft) {
    return "DRAFTED";
  }
  if (records.hasRejected) {
    return "REJECTED";
  }
  return "MATCHED";
}

export function allowedPipelineMoves(records: PipelineRecords): PipelineStage[] {
  const allowed: PipelineStage[] = [];
  if (records.prospectExists) {
    allowed.push("MATCHED");
  }
  if (records.hasDraft) {
    allowed.push("DRAFTED");
  }
  if (records.hasApproved) {
    allowed.push("APPROVED");
  }
  if (records.hasDryRunCompletedAudit) {
    allowed.push("DRY_RUN_SENT");
  }
  if (records.hasRejected) {
    allowed.push("REJECTED");
  }
  allowed.push(...MANUAL_PIPELINE_STAGES);
  return [...new Set(allowed)];
}

export function resolveDisplayedStage(input: {
  records: PipelineRecords;
  manualStage?: PipelineStage | null;
}): {
  stage: PipelineStage | null;
  source: "derived" | "manual";
} {
  const derived = deriveAutoStage(input.records);
  if (input.manualStage && isManualPipelineStage(input.manualStage)) {
    return { stage: input.manualStage, source: "manual" };
  }
  if (
    input.manualStage &&
    isAutoPipelineStage(input.manualStage) &&
    allowedPipelineMoves(input.records).includes(input.manualStage)
  ) {
    return { stage: input.manualStage, source: "manual" };
  }
  return { stage: derived, source: "derived" };
}

export function hasDryRunCompletedAudit(event: {
  action: string;
  after?: unknown;
}): boolean {
  if (event.action === DRY_RUN_COMPLETED_STATUS) {
    return true;
  }
  if (event.action !== "outreach.transition") {
    return false;
  }
  if (!event.after || typeof event.after !== "object") {
    return false;
  }
  return (
    "status" in event.after &&
    event.after.status === DRY_RUN_COMPLETED_STATUS
  );
}

export function parseManualStageMove(event: {
  action: string;
  actorId: string;
  createdAt: Date | string;
  after?: unknown;
}): {
  stage: PipelineStage;
  actorId: string;
  at: string;
} | null {
  if (event.action !== PIPELINE_STAGE_MOVE_ACTION) {
    return null;
  }
  if (!event.after || typeof event.after !== "object") {
    return null;
  }
  const after = event.after as {
    stage?: unknown;
    source?: unknown;
  };
  if (!isPipelineStage(after.stage)) {
    return null;
  }
  const at =
    event.createdAt instanceof Date
      ? event.createdAt.toISOString()
      : event.createdAt;
  return { stage: after.stage, actorId: event.actorId, at };
}

