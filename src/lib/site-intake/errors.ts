export const SITE_INTAKE_ERROR_CODES = [
  "INVALID_URL",
  "BLOCKED_HOST",
  "BLOCKED_IP",
  "DNS_FAILED",
  "REDIRECT_LIMIT",
  "TIMEOUT",
  "PAGE_TOO_LARGE",
  "UNSUPPORTED_CONTENT",
  "FETCH_FAILED",
  "NO_PAGES",
  "INFERENCE_FAILED",
] as const;

export type SiteIntakeErrorCode = (typeof SITE_INTAKE_ERROR_CODES)[number];

export class SiteIntakeError extends Error {
  readonly code: SiteIntakeErrorCode;

  constructor(code: SiteIntakeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SiteIntakeError";
    this.code = code;
  }
}

export function isSiteIntakeError(error: unknown): error is SiteIntakeError {
  return error instanceof SiteIntakeError;
}
