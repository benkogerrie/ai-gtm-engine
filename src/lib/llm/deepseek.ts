import { z, type ZodType } from "zod";
import { readLlmEnv } from "./config";
import {
  LlmInvalidJsonError,
  LlmInvalidResponseError,
  LlmMissingApiKeyError,
} from "./errors";
import { chatCompletionsUrl, fetchWithRetry, type FetchLike, type SleepFn } from "./http";
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmClient,
  LlmJsonResult,
  LlmMessage,
  LlmTokenUsage,
  LlmUsageRecord,
} from "./types";

export type DeepSeekLlmClientOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxAttempts: number;
  fetchFn?: FetchLike;
  sleepFn?: SleepFn;
  nowFn?: () => number;
};

const chatCompletionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.string().nullable().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

function usageFromResponse(
  usage: z.infer<typeof chatCompletionSchema>["usage"],
): LlmTokenUsage {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function buildUsageRecord(
  model: string,
  usage: LlmTokenUsage,
  latencyMs: number,
  createdAt: string,
): LlmUsageRecord {
  return {
    provider: "deepseek",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    latencyMs,
    createdAt,
  };
}

function ensureJsonHint(messages: LlmMessage[]): LlmMessage[] {
  const mentionsJson = messages.some((message) =>
    message.content.toLowerCase().includes("json"),
  );
  if (mentionsJson) {
    return messages;
  }
  return [
    {
      role: "system",
      content:
        "Respond with a JSON object only. Do not wrap the JSON in markdown.",
    },
    ...messages,
  ];
}

function describeJsonFailure(content: string): string {
  return `Response was not valid JSON: ${content.slice(0, 280)}`;
}

export class DeepSeekLlmClient implements LlmClient {
  readonly provider = "deepseek";
  readonly model: string;
  private readonly options: DeepSeekLlmClientOptions;

  constructor(options: DeepSeekLlmClientOptions) {
    if (!options.apiKey.trim()) {
      throw new LlmMissingApiKeyError();
    }
    this.options = options;
    this.model = options.model;
  }

  async chat(
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmChatResult> {
    return this.complete(messages, options, false);
  }

  async json<T>(
    schema: ZodType<T>,
    messages: LlmMessage[],
    options?: LlmCallOptions,
  ): Promise<LlmJsonResult<T>> {
    const hinted = ensureJsonHint(messages);
    const first = await this.complete(hinted, options, true);
    const firstParsed = this.parseJson(first.content, schema);
    if (firstParsed.ok) {
      return { ...first, data: firstParsed.data };
    }

    const repairMessages: LlmMessage[] = [
      ...hinted,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: [
          "Your previous output was not valid JSON matching the required schema.",
          `Validation issues: ${firstParsed.issues}`,
          "Return a corrected JSON object only. Do not include markdown.",
        ].join("\n"),
      },
    ];

    const repaired = await this.complete(repairMessages, options, true);
    const secondParsed = this.parseJson(repaired.content, schema);
    if (secondParsed.ok) {
      return {
        ...repaired,
        data: secondParsed.data,
        usage: {
          promptTokens: first.usage.promptTokens + repaired.usage.promptTokens,
          completionTokens:
            first.usage.completionTokens + repaired.usage.completionTokens,
          totalTokens: first.usage.totalTokens + repaired.usage.totalTokens,
        },
        latencyMs: first.latencyMs + repaired.latencyMs,
        usageRecord: buildUsageRecord(
          repaired.model,
          {
            promptTokens: first.usage.promptTokens + repaired.usage.promptTokens,
            completionTokens:
              first.usage.completionTokens + repaired.usage.completionTokens,
            totalTokens: first.usage.totalTokens + repaired.usage.totalTokens,
          },
          first.latencyMs + repaired.latencyMs,
          repaired.usageRecord.createdAt,
        ),
      };
    }

    throw new LlmInvalidJsonError(secondParsed.issues, repaired.content);
  }

  private parseJson<T>(
    content: string,
    schema: ZodType<T>,
  ): { ok: true; data: T } | { ok: false; issues: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, issues: describeJsonFailure(content) };
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { ok: true, data: result.data };
    }
    return { ok: false, issues: z.prettifyError(result.error) };
  }

  private async complete(
    messages: LlmMessage[],
    options: LlmCallOptions | undefined,
    jsonMode: boolean,
  ): Promise<LlmChatResult> {
    const now = this.options.nowFn ?? Date.now;
    const startedAt = now();
    const timeoutMs = options?.timeoutMs ?? this.options.timeoutMs;
    const url = chatCompletionsUrl(this.options.baseUrl);

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: false,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      {
        timeoutMs,
        maxAttempts: this.options.maxAttempts,
        fetchFn: this.options.fetchFn,
        sleepFn: this.options.sleepFn,
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new LlmInvalidResponseError(
        "LLM response was not valid JSON",
        { cause: error },
      );
    }

    const parsed = chatCompletionSchema.safeParse(payload);
    if (!parsed.success) {
      throw new LlmInvalidResponseError(
        `LLM chat completion payload was malformed: ${z.prettifyError(parsed.error)}`,
      );
    }

    const content = parsed.data.choices[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmInvalidResponseError(
        "LLM chat completion did not include message content",
      );
    }

    const model = parsed.data.model ?? this.options.model;
    const usage = usageFromResponse(parsed.data.usage);
    const latencyMs = Math.max(0, now() - startedAt);

    return {
      content,
      model,
      usage,
      latencyMs,
      usageRecord: buildUsageRecord(
        model,
        usage,
        latencyMs,
        new Date(now()).toISOString(),
      ),
    };
  }
}

export function createDeepSeekLlmClient(
  overrides: Partial<DeepSeekLlmClientOptions> = {},
): DeepSeekLlmClient {
  const env = readLlmEnv();
  const apiKey = overrides.apiKey ?? env.apiKey;
  if (!apiKey) {
    throw new LlmMissingApiKeyError();
  }

  return new DeepSeekLlmClient({
    apiKey,
    model: overrides.model ?? env.model,
    baseUrl: overrides.baseUrl ?? env.baseUrl,
    timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    maxAttempts: overrides.maxAttempts ?? env.maxAttempts,
    fetchFn: overrides.fetchFn,
    sleepFn: overrides.sleepFn,
    nowFn: overrides.nowFn,
  });
}
