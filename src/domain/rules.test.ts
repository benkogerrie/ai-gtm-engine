import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  assertDryRunCannotBeSent,
  assertOutreachTransition,
  assertSentHasApproval,
  assertVerifiedClaimHasCitation,
} from "./rules";

const outreachId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgId = "11111111-1111-4111-8111-111111111111";

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
  const validApproval = {
    outreachId,
    orgId,
    approvedBy: "rep-1",
    approvedAt: new Date(),
    decision: "APPROVED" as const,
  };

  it("rejects SENT without an approval record", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: null,
      }),
    ).toThrow(DomainError);
  });

  it("rejects SENT when approval decision is undefined", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: {
          ...validApproval,
          decision: undefined,
        },
      }),
    ).toThrow(/SENT_WITHOUT_APPROVAL|decision APPROVED/);
  });

  it("rejects SENT when approval decision is REJECTED", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: { ...validApproval, decision: "REJECTED" },
      }),
    ).toThrow(DomainError);
  });

  it("rejects SENT when approval is for another outreach", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: {
          ...validApproval,
          outreachId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      }),
    ).toThrow(DomainError);
  });

  it("rejects SENT when approval is for another org", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: {
          ...validApproval,
          orgId: "22222222-2222-4222-8222-222222222222",
        },
      }),
    ).toThrow(DomainError);
  });

  it("accepts SENT with explicit APPROVED for the same outreach and org", () => {
    expect(() =>
      assertSentHasApproval({
        status: "SENT",
        outreachId,
        orgId,
        approval: validApproval,
      }),
    ).not.toThrow();
  });

  it("rejects recording a dry-run as SENT", () => {
    expect(() =>
      assertDryRunCannotBeSent({ status: "SENT", dryRun: true }),
    ).toThrow(/DRY_RUN_CANNOT_BE_SENT|Dry-run/);
  });

  it("blocks illegal status transitions", () => {
    expect(() => assertOutreachTransition("DRAFT", "SENT")).toThrow(
      /cannot move/,
    );
    expect(() =>
      assertOutreachTransition("PENDING_APPROVAL", "APPROVED"),
    ).not.toThrow();
    expect(() =>
      assertOutreachTransition("APPROVED", "DRY_RUN_COMPLETED"),
    ).not.toThrow();
  });
});
