import { describe, expect, it, vi } from "vitest";
import type { DashboardCard } from "@/lib/pipeline/board";
import type { DashboardActionState } from "./actions";
import {
  applyOptimisticMove,
  buildMoveFormData,
  handlePipelineDrop,
  parsePipelineDragPayload,
} from "./pipeline-dnd";

type MoveFn = (
  prev: DashboardActionState,
  formData: FormData,
) => Promise<DashboardActionState>;

function card(overrides: Partial<DashboardCard> = {}): DashboardCard {
  return {
    companyId: "company-1",
    name: "HCA Healthcare",
    domain: "hcahealthcare.com",
    websiteUrl: "https://hcahealthcare.com",
    fitScore: 82,
    rationale: "",
    evidenceRelevance: null,
    stage: "MATCHED",
    stageSource: "derived",
    stageAt: null,
    stageActor: null,
    allowedMoves: ["REPLIED", "MEETING_BOOKED", "CLOSED_LOST"],
    outreachId: null,
    channels: [],
    evidence: [],
    ...overrides,
  };
}

describe("parsePipelineDragPayload", () => {
  it("accepts a valid payload and rejects junk", () => {
    expect(
      parsePipelineDragPayload(
        JSON.stringify({ companyId: "company-1", fromStage: "MATCHED" }),
      ),
    ).toEqual({ companyId: "company-1", fromStage: "MATCHED" });
    expect(parsePipelineDragPayload("not-json")).toBeNull();
    expect(
      parsePipelineDragPayload(
        JSON.stringify({ companyId: "company-1", fromStage: "NOPE" }),
      ),
    ).toBeNull();
  });
});

describe("handlePipelineDrop", () => {
  it("calls the existing move action with companyId, stage, and runId", async () => {
    const move = vi.fn<MoveFn>(async () => ({}));
    const cards = [card()];

    const result = await handlePipelineDrop({
      cards,
      companyId: "company-1",
      fromStage: "MATCHED",
      toStage: "REPLIED",
      icpId: "icp-9",
      runId: "run-42",
      move,
    });

    expect(move).toHaveBeenCalledTimes(1);
    const formData = move.mock.calls[0]?.[1];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error("expected FormData");
    }
    expect(formData.get("companyId")).toBe("company-1");
    expect(formData.get("stage")).toBe("REPLIED");
    expect(formData.get("runId")).toBe("run-42");
    expect(formData.get("icpId")).toBe("icp-9");
    expect(result.error).toBeUndefined();
    expect(result.cards[0]?.stage).toBe("REPLIED");
    expect(result.cards[0]?.stageSource).toBe("manual");
  });

  it("reverts to the original cards and surfaces the existing error", async () => {
    const cards = [card({ stage: "MATCHED", stageSource: "derived" })];
    const move = vi.fn<MoveFn>(async () => ({
      error: "Cannot move to DRY_RUN_SENT without a real record for that stage",
    }));

    const result = await handlePipelineDrop({
      cards,
      companyId: "company-1",
      fromStage: "MATCHED",
      toStage: "DRY_RUN_SENT",
      runId: "run-42",
      move,
    });

    const formData = move.mock.calls[0]?.[1];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error("expected FormData");
    }
    expect(formData.get("companyId")).toBe("company-1");
    expect(formData.get("stage")).toBe("DRY_RUN_SENT");
    expect(formData.get("runId")).toBe("run-42");
    expect(result.error).toBe(
      "Cannot move to DRY_RUN_SENT without a real record for that stage",
    );
    expect(result.cards).toBe(cards);
    expect(result.cards[0]?.stage).toBe("MATCHED");
    expect(result.cards[0]?.stageSource).toBe("derived");
  });

  it("does not call move when the card is dropped on its current stage", async () => {
    const move = vi.fn<MoveFn>(async () => ({}));
    const cards = [card()];
    const result = await handlePipelineDrop({
      cards,
      companyId: "company-1",
      fromStage: "MATCHED",
      toStage: "MATCHED",
      runId: "run-42",
      move,
    });
    expect(move).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.cards).toBe(cards);
  });
});

describe("applyOptimisticMove", () => {
  it("moves the card and marks the stage as manual", () => {
    const moved = applyOptimisticMove(
      [card({ stageSource: "derived" })],
      "company-1",
      "REPLIED",
    );
    expect(moved[0]?.stage).toBe("REPLIED");
    expect(moved[0]?.stageSource).toBe("manual");
  });
});

describe("buildMoveFormData", () => {
  it("omits empty icp and run ids", () => {
    const formData = buildMoveFormData({
      companyId: "company-1",
      stage: "REPLIED",
    });
    expect(formData.get("companyId")).toBe("company-1");
    expect(formData.get("stage")).toBe("REPLIED");
    expect(formData.get("icpId")).toBeNull();
    expect(formData.get("runId")).toBeNull();
  });
});
