export const DOMAIN_ERROR_CODES = [
  "VERIFIED_WITHOUT_CITATION",
  "SENT_WITHOUT_APPROVAL",
  "INVALID_STATUS_TRANSITION",
  "DRY_RUN_CANNOT_BE_SENT",
  "CITATION_NOT_FOUND",
  "CITATION_ORG_MISMATCH",
  "ENTITY_NOT_FOUND",
  "ENTITY_ORG_MISMATCH",
  "ICP_INFERENCE_INVALID",
  "ICP_NOT_FOUND",
  "ICP_ORG_MISMATCH",
  "EXPANSION_NOT_FOUND",
  "NO_CITED_SIGNALS",
  "OUTREACH_NOT_FOUND",
  "OUTREACH_ORG_MISMATCH",
  "OUTREACH_NOT_APPROVED",
  "HUMAN_ACTOR_REQUIRED",
  "PIPELINE_STAGE_UNAVAILABLE",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
