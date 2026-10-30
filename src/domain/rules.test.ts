import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  assertOutreachTransition,
  assertSentHasApproval,
  assertVerifiedClaimHasCitation,
} from "./rules";

describe("verification rules", () => {
  it("rejects VERIFIED claims without a sourced citation", () => {
    expect(() =>
      assertVerifiedClaimHasCitation({
        verificationStatus: "VERIFIED",
        citations: [],
      }),
    ).toThrow(DomainError);

    expect(() =>
      assertVerifiedClaimHasCitation({
        verificationStatus: "VERIFIED",
        citations: [{ sourceUrl: null, retrievedAt: new Date() }],
      }),
    ).toThrow(/sourceUrl and retrievedAt/);
  });

  it("allows UNVERIFIED or INFERRED claims without citations", () => {
    expect(() =>
      assertVerifiedClaimHasCitation({
        verificationStatus: "UNVERIFIED",
        citations: [],
      }),
    ).not.toThrow();

    expect(() =>
      assertVerifiedClaimHasCitation({
        verificationStatus: "INFERRED",
        citations: [],
      }),
    ).not.toThrow();
  });

  it("accepts VERIFIED claims with sourceUrl and retrievedAt", () => {
    expect(() =>
      assertVerifiedClaimHasCitation({
        verificationStatus: "VERIFIED",
        citations: [
          {
            sourceUrl: "https://example.test/about",
            retrievedAt: "2026-10-15T12:00:00.000Z",
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe("outreach HITL rules", () => {
  it("rejects SENT without an approval record", () => {
    expect(() =>
      assertSentHasApproval({ status: "SENT", approval: null }),
    ).toThrow(DomainError);
  });

  it("accepts SENT with approvedBy and approvedAt", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        approval: {
          approvedBy: "rep-1",
          approvedAt: new Date(),
          decision: "APPROVED",
        },
      }),
    ).not.toThrow();
  });

  it("blocks illegal status transitions", () => {
    expect(() => assertOutreachTransition("DRAFT", "SENT")).toThrow(
      /cannot move/,
    );
    expect(() =>
      assertOutreachTransition("PENDING_APPROVAL", "APPROVED"),
    ).not.toThrow();
  });
});
