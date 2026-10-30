export const SEARCH_ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  HTTP: "HTTP",
  TIMEOUT: "TIMEOUT",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  SYNTHETIC_EVIDENCE: "SYNTHETIC_EVIDENCE",
} as const;

export type SearchErrorCode =
  (typeof SEARCH_ERROR_CODES)[keyof typeof SEARCH_ERROR_CODES];

export class SearchError extends Error {
  readonly code: SearchErrorCode;

  constructor(
    message: string,
    code: SearchErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SearchMissingApiKeyError extends SearchError {
  constructor(
    message = "BRAVE_SEARCH_API_KEY is not set. Configure it in the environment; never commit the key.",
  ) {
    super(message, SEARCH_ERROR_CODES.MISSING_API_KEY);
  }
}

export class SearchHttpError extends SearchError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    const excerpt = body.trim().slice(0, 280);
    super(
      excerpt ? `Search HTTP ${status}: ${excerpt}` : `Search HTTP ${status}`,
      SEARCH_ERROR_CODES.HTTP,
    );
    this.status = status;
    this.body = body;
  }
}

export class SearchTimeoutError extends SearchError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `Search request timed out after ${timeoutMs}ms`,
      SEARCH_ERROR_CODES.TIMEOUT,
    );
    this.timeoutMs = timeoutMs;
  }
}

export class SearchInvalidRequestError extends SearchError {
  constructor(message: string) {
    super(message, SEARCH_ERROR_CODES.INVALID_REQUEST);
  }
}

export class SearchInvalidResponseError extends SearchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, SEARCH_ERROR_CODES.INVALID_RESPONSE, options);
  }
}

export class SearchSyntheticEvidenceError extends SearchError {
  constructor(
    message = "Synthetic search results (source: mock) cannot become citations.",
  ) {
    super(message, SEARCH_ERROR_CODES.SYNTHETIC_EVIDENCE);
  }
}

export function isSearchError(error: unknown): error is SearchError {
  return error instanceof SearchError;
}
