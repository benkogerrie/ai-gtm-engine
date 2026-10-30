import type { DashboardCard } from "@/lib/pipeline/board";
import {
  isPipelineStage,
  type PipelineStage,
} from "@/lib/pipeline/stages";
import type { DashboardActionState } from "./actions";

export const PIPELINE_DRAG_MIME = "application/x-pipeline-card";

export type PipelineDragPayload = {
  companyId: string;
  fromStage: PipelineStage;
};

export function parsePipelineDragPayload(
  raw: string,
): PipelineDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PipelineDragPayload>;
    if (
      typeof parsed.companyId !== "string" ||
      !parsed.companyId ||
      !isPipelineStage(parsed.fromStage)
    ) {
      return null;
    }
    return { companyId: parsed.companyId, fromStage: parsed.fromStage };
  } catch {
    return null;
  }
}

export function buildMoveFormData(input: {
  companyId: string;
  stage: PipelineStage;
  icpId?: string;
  runId?: string;
}): FormData {
  const formData = new FormData();
  formData.set("companyId", input.companyId);
  formData.set("stage", input.stage);
  if (input.icpId) {
    formData.set("icpId", input.icpId);
  }
  if (input.runId) {
    formData.set("runId", input.runId);
  }
  return formData;
}

export function applyOptimisticMove(
  cards: DashboardCard[],
  companyId: string,
  stage: PipelineStage,
): DashboardCard[] {
  return cards.map((card) =>
    card.companyId === companyId
      ? { ...card, stage, stageSource: "manual" as const }
      : card,
  );
}

export async function handlePipelineDrop(input: {
  cards: DashboardCard[];
  companyId: string;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  icpId?: string;
  runId?: string;
  move: (
    prev: DashboardActionState,
    formData: FormData,
  ) => Promise<DashboardActionState>;
}): Promise<{ cards: DashboardCard[]; error?: string; skipped?: boolean }> {
  if (input.fromStage === input.toStage) {
    return { cards: input.cards, skipped: true };
  }

  const result = await input.move(
    {},
    buildMoveFormData({
      companyId: input.companyId,
      stage: input.toStage,
      icpId: input.icpId,
      runId: input.runId,
    }),
  );

  if (result.error) {
    return { cards: input.cards, error: result.error };
  }

  return {
    cards: applyOptimisticMove(input.cards, input.companyId, input.toStage),
  };
}
