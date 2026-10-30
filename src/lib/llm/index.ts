import { isLlmConfigured } from "./config";
import { createDeepSeekLlmClient } from "./deepseek";
import { createMockLlmClient } from "./mock";
import type { LlmClient } from "./types";

export {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MAX_ATTEMPTS,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  getLlmBaseUrl,
  getLlmConfig,
  getLlmHealth,
  getLlmModel,
  isLlmConfigured,
  readLlmEnv,
} from "./config";
export type { LlmEnvConfig, LlmEnvSnapshot, LlmHealthStatus } from "./config";
export {
  DeepSeekLlmClient,
  createDeepSeekLlmClient,
} from "./deepseek";
export type { DeepSeekLlmClientOptions } from "./deepseek";
export {
  LLM_ERROR_CODES,
  LlmError,
  LlmHttpError,
  LlmInvalidJsonError,
  LlmInvalidResponseError,
  LlmMissingApiKeyError,
  LlmTimeoutError,
  isLlmError,
} from "./errors";
export { MockLlmClient, createMockLlmClient } from "./mock";
export type { MockLlmClientOptions } from "./mock";
export type {
  LlmCallOptions,
  LlmChatResult,
  LlmClient,
  LlmJsonResult,
  LlmMessage,
  LlmRole,
  LlmTokenUsage,
  LlmUsageRecord,
} from "./types";

export type CreateLlmClientOptions = {
  /**
   * When true, return a MockLlmClient if DEEPSEEK_API_KEY is unset.
   * Default is false: missing key throws LlmMissingApiKeyError.
   */
  allowMockIfUnconfigured?: boolean;
};

export function createLlmClient(
  options: CreateLlmClientOptions = {},
): LlmClient {
  if (!isLlmConfigured() && options.allowMockIfUnconfigured) {
    return createMockLlmClient();
  }
  return createDeepSeekLlmClient();
}
