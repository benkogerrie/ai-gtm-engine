export const LLM_ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  HTTP: "HTTP",
  TIMEOUT: "TIMEOUT",
  INVALID_JSON: "INVALID_JSON",
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

export type LlmErrorCode = (typeof LLM_ERROR_CODES)[keyof typeof LLM_ERROR_CODES];

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(message: string, code: LlmErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LlmMissingApiKeyError extends LlmError {
  constructor(
    message = "DEEPSEEK_API_KEY is not set. Configure it in the environment; never commit the key.",
  ) {
    super(message, LLM_ERROR_CODES.MISSING_API_KEY);
  }
}

export class LlmHttpError extends LlmError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    const excerpt = body.trim().slice(0, 280);
    super(
      excerpt
        ? `LLM HTTP ${status}: ${excerpt}`
        : `LLM HTTP ${status}`,
      LLM_ERROR_CODES.HTTP,
    );
    this.status = status;
    this.body = body;
  }
}

export class LlmTimeoutError extends LlmError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`, LLM_ERROR_CODES.TIMEOUT);
    this.timeoutMs = timeoutMs;
  }
}

export class LlmInvalidJsonError extends LlmError {
  readonly issues: string;
  readonly rawContent: string;

  constructor(issues: string, rawContent: string) {
    super(
      `LLM JSON output failed validation after one repair attempt: ${issues}`,
      LLM_ERROR_CODES.INVALID_JSON,
    );
    this.issues = issues;
    this.rawContent = rawContent;
  }
}

export class LlmInvalidResponseError extends LlmError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, LLM_ERROR_CODES.INVALID_RESPONSE, options);
  }
}

export function isLlmError(error: unknown): error is LlmError {
  return error instanceof LlmError;
}
