import { DomainError } from "./errors";
import type { OutreachStatus, VerificationStatus } from "./enums";

export type CitationEvidence = {
  sourceUrl?: string | null;
  retrievedAt?: Date | string | null;
};

export function citationSupportsVerification(
  citation: CitationEvidence,
): boolean {
  return Boolean(citation.sourceUrl) && Boolean(citation.retrievedAt);
}

export function assertVerifiedClaimHasCitation(input: {
  verificationStatus: VerificationStatus;
  citations: CitationEvidence[];
}): void {
  if (input.verificationStatus !== "VERIFIED") {
    return;
  }

  const hasSupportingCitation = input.citations.some(citationSupportsVerification);
  if (!hasSupportingCitation) {
    throw new DomainError(
      "VERIFIED_WITHOUT_CITATION",
      "A VERIFIED claim requires at least one citation with sourceUrl and retrievedAt. Unknown is UNVERIFIED, never fabricated. A URL and timestamp are necessary but do not by themselves prove the claim is true.",
    );
  }
}

const OUTREACH_TRANSITIONS: Record<OutreachStatus, readonly OutreachStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "REJECTED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED: ["SENT", "DRY_RUN_COMPLETED", "REJECTED"],
  SENT: [],
  DRY_RUN_COMPLETED: [],
  REJECTED: [],
};

export function assertOutreachTransition(
  from: OutreachStatus,
  to: OutreachStatus,
): void {
  if (from === to) {
    return;
  }

  if (!OUTREACH_TRANSITIONS[from].includes(to)) {
    throw new DomainError(
      "INVALID_STATUS_TRANSITION",
      `Outreach cannot move from ${from} to ${to}`,
    );
  }
}

export type ApprovalRecord = {
  outreachId?: string | null;
  orgId?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  decision?: "APPROVED" | "REJECTED" | null;
};

export function assertSentHasApproval(input: {
  status: OutreachStatus;
  outreachId: string;
  orgId: string;
  approval?: ApprovalRecord | null;
}): void {
  if (input.status !== "SENT") {
    return;
  }

  const approval = input.approval;
  const approved =
    approval?.decision === "APPROVED" &&
    Boolean(approval.approvedBy) &&
    Boolean(approval.approvedAt) &&
    approval.outreachId === input.outreachId &&
    approval.orgId === input.orgId;

  if (!approved) {
    throw new DomainError(
      "SENT_WITHOUT_APPROVAL",
      "Outreach status SENT requires an approval record for the same outreach and org with decision APPROVED, approvedBy, and approvedAt",
    );
  }
}

export function assertDryRunCannotBeSent(input: {
  status: OutreachStatus;
  dryRun: boolean;
}): void {
  if (input.status === "SENT" && input.dryRun) {
    throw new DomainError(
      "DRY_RUN_CANNOT_BE_SENT",
      "Dry-run outreach cannot be recorded as SENT; use DRY_RUN_COMPLETED and leave sentAt empty",
    );
  }
}

export function assertDryRunCompleted(input: {
  status: OutreachStatus;
  dryRun: boolean;
}): void {
  if (input.status !== "DRY_RUN_COMPLETED") {
    return;
  }
  if (!input.dryRun) {
    throw new DomainError(
      "INVALID_STATUS_TRANSITION",
      "DRY_RUN_COMPLETED is only valid when dryRun is true",
    );
  }
}
