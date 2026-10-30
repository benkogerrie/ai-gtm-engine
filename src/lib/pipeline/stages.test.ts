import { describe, expect, it } from "vitest";
import {
  allowedPipelineMoves,
  deriveAutoStage,
  hasDryRunCompletedAudit,
  resolveDisplayedStage,
} from "./stages";

const MATCHED = {
  prospectExists: true,
  hasDraft: false,
  hasApproved: false,
  hasDryRunCompletedAudit: false,
  hasRejected: false,
};

describe("deriveAutoStage", () => {
  it("does not invent a stage when no prospect exists", () => {
    expect(
      deriveAutoStage({
        prospectExists: false,
        hasDraft: false,
        hasApproved: false,
        hasDryRunCompletedAudit: false,
        hasRejected: false,
      }),
    ).toBeNull();
  });

  it("requires a real record for each later auto stage", () => {
    expect(deriveAutoStage(MATCHED)).toBe("MATCHED");
    expect(deriveAutoStage({ ...MATCHED, hasDraft: true })).toBe("DRAFTED");
    expect(
      deriveAutoStage({ ...MATCHED, hasDraft: true, hasApproved: true }),
    ).toBe("APPROVED");
    expect(
      deriveAutoStage({
        ...MATCHED,
        hasDraft: true,
        hasApproved: true,
        hasDryRunCompletedAudit: true,
      }),
    ).toBe("DRY_RUN_SENT");
    expect(deriveAutoStage({ ...MATCHED, hasRejected: true })).toBe("REJECTED");
  });

  it("does not treat a missing dry-run audit as sent", () => {
    expect(
      hasDryRunCompletedAudit({
        action: "outreach.transition",
        after: { status: "APPROVED" },
      }),
    ).toBe(false);
    expect(
      hasDryRunCompletedAudit({
        action: "outreach.transition",
        after: { status: "DRY_RUN_COMPLETED" },
      }),
    ).toBe(true);
    expect(
      allowedPipelineMoves(MATCHED).includes("DRY_RUN_SENT"),
    ).toBe(false);
    expect(allowedPipelineMoves(MATCHED).includes("DRAFTED")).toBe(false);
    expect(allowedPipelineMoves(MATCHED)).toEqual(
      expect.arrayContaining(["MATCHED", "REPLIED", "MEETING_BOOKED", "CLOSED_LOST"]),
    );
  });

  it("labels later human stages as manual and never fabricates replies", () => {
    const displayed = resolveDisplayedStage({
      records: MATCHED,
      manualStage: "REPLIED",
    });
    expect(displayed).toEqual({ stage: "REPLIED", source: "manual" });
    expect(deriveAutoStage(MATCHED)).toBe("MATCHED");
    expect(
      allowedPipelineMoves({
        ...MATCHED,
        hasDraft: false,
      }).includes("DRAFTED"),
    ).toBe(false);
  });
});
