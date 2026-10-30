import type { ZodType } from "zod";
import { LlmInvalidJsonError } from "./errors";
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmClient,
  LlmJsonResult,
  LlmMessage,
  LlmTokenUsage,
  LlmUsageRecord,
} from "./types";

export type MockLlmClientOptions = {
  model?: string;
  chatContent?: string;
  jsonValue?: unknown;
  latencyMs?: number;
  usage?: LlmTokenUsage;
  chatHandler?: (
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ) => Promise<string> | string;
  jsonHandler?: <T>(
    schema: ZodType<T>,
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ) => Promise<T> | T;
};

const DEFAULT_USAGE: LlmTokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export class MockLlmClient implements LlmClient {
  readonly provider = "mock";
  readonly model: string;
  private readonly options: MockLlmClientOptions;

  constructor(options: MockLlmClientOptions = {}) {
    this.options = options;
    this.model = options.model ?? "mock";
  }

  async chat(
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmChatResult> {
    const content = this.options.chatHandler
      ? await this.options.chatHandler(messages, options)
      : (this.options.chatContent ?? "");
    return this.wrap(content);
  }

  async json<T>(
    schema: ZodType<T>,
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmJsonResult<T>> {
    const raw = this.options.jsonHandler
      ? await this.options.jsonHandler(schema, messages, options)
      : this.options.jsonValue;

    if (raw === undefined) {
      throw new LlmInvalidJsonError(
        "MockLlmClient has no JSON value configured",
        "",
      );
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new LlmInvalidJsonError(
        parsed.error.message,
        JSON.stringify(raw),
      );
    }

    return {
      ...this.wrap(JSON.stringify(parsed.data)),
      data: parsed.data,
    };
  }

  private wrap(content: string): LlmChatResult {
    const usage = this.options.usage ?? DEFAULT_USAGE;
    const latencyMs = this.options.latencyMs ?? 0;
    const usageRecord: LlmUsageRecord = {
      provider: this.provider,
      model: this.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      latencyMs,
      createdAt: new Date(0).toISOString(),
    };

    return {
      content,
      model: this.model,
      usage,
      latencyMs,
      usageRecord,
    };
  }
}

export function createMockLlmClient(
  options: MockLlmClientOptions = {},
): MockLlmClient {
  return new MockLlmClient(options);
}
