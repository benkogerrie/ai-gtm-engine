export const DOMAIN_ERROR_CODES = [
  "VERIFIED_WITHOUT_CITATION",
  "SENT_WITHOUT_APPROVAL",
  "INVALID_STATUS_TRANSITION",
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
