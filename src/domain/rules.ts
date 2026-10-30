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
      "A VERIFIED claim requires at least one citation with sourceUrl and retrievedAt. Unknown is UNVERIFIED, never fabricated.",
    );
  }
}

const OUTREACH_TRANSITIONS: Record<OutreachStatus, readonly OutreachStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "REJECTED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED: ["SENT", "REJECTED"],
  SENT: [],
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
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  decision?: "APPROVED" | "REJECTED" | null;
};

export function assertSentHasApproval(input: {
  status: OutreachStatus;
  approval?: ApprovalRecord | null;
}): void {
  if (input.status !== "SENT") {
    return;
  }

  const approval = input.approval;
  const approved =
    Boolean(approval?.approvedBy) &&
    Boolean(approval?.approvedAt) &&
    (approval?.decision === undefined || approval.decision === "APPROVED");

  if (!approved) {
    throw new DomainError(
      "SENT_WITHOUT_APPROVAL",
      "Outreach status SENT requires an approval record with approvedBy and approvedAt",
    );
  }
}
