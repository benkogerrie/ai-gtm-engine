import type { ZodType } from "zod";

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/**
 * Persistable per-call usage row for later ledger/billing tasks.
 * Cost is omitted unless a later task can apply a sourced price table.
 */
export type LlmUsageRecord = {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  createdAt: string;
};

export type LlmCallOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type LlmChatResult = {
  content: string;
  model: string;
  usage: LlmTokenUsage;
  latencyMs: number;
  usageRecord: LlmUsageRecord;
};

export type LlmJsonResult<T> = LlmChatResult & {
  data: T;
};

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  chat(
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmChatResult>;
  json<T>(
    schema: ZodType<T>,
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmJsonResult<T>>;
}
