// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmIcpOutputSchema } from "@/domain";
import {
  LlmInvalidJsonError,
  type LlmChatResult,
  type LlmClient,
  type LlmJsonResult,
} from "@/lib/llm";
import { createMockLlmClient } from "@/lib/llm";
import { failingLiveShape } from "./failing-live-shape";
import { inferStructuredIcp } from "./infer";
import { buildMockIcpOutput } from "./mock-output";

const intake = {
  name: "Harborline Ops Cloud",
  description: "Freight brokerage operations platform",
  features: ["lane scoring"],
  capabilities: ["intake"],
  existingCustomers: ["Cedar Freight"],
};

function wrap(content: string): LlmChatResult {
  return {
    content,
    model: "test",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latencyMs: 1,
    usageRecord: {
      provider: "mock",
      model: "test",
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      latencyMs: 1,
      createdAt: new Date(0).toISOString(),
    },
  };
}

class RepairJsonClient implements LlmClient {
  readonly provider = "mock";
  readonly model = "repair";
  calls = 0;

  constructor(private readonly values: unknown[]) {}

  async chat(): Promise<LlmChatResult> {
    return wrap("");
  }

  async json<T>(
    schema: z.ZodType<T>,
  ): Promise<LlmJsonResult<T>> {
    for (const value of this.values.slice(0, 2)) {
      this.calls += 1;
      const parsed = schema.safeParse(value);
      if (parsed.success) {
        return { ...wrap(JSON.stringify(parsed.data)), data: parsed.data };
      }
    }
    throw new LlmInvalidJsonError("failed after one repair attempt", "{}");
  }
}

describe("ICP inference", () => {
  it("returns a typed structured ICP from a valid mock client", async () => {
    const raw = buildMockIcpOutput(intake);
    const client = createMockLlmClient({ jsonValue: raw });
    const result = await inferStructuredIcp(client, intake);
    expect(result.inferenceMode).toBe("mock");
    expect(result.structured.targetIndustries.length).toBeGreaterThan(0);
    expect(
      result.structured.targetIndustries.every(
        (industry) => industry.status === "INFERRED",
      ),
    ).toBe(true);
    expect(result.structured.expansionSuggestions[0]?.decision).toBe("PENDING");
  });

  it("repairs once then returns typed data", async () => {
    const client = new RepairJsonClient([
      { nope: true },
      buildMockIcpOutput(intake),
    ]);
    const result = await inferStructuredIcp(client, intake);
    expect(client.calls).toBe(2);
    expect(llmIcpOutputSchema.safeParse(buildMockIcpOutput(intake)).success).toBe(
      true,
    );
    expect(result.structured.name).toContain("ICP");
  });

  it("throws a typed error when JSON is still invalid after repair", async () => {
    const client = new RepairJsonClient([{ nope: true }, { still: "bad" }]);
    await expect(inferStructuredIcp(client, intake)).rejects.toBeInstanceOf(
      LlmInvalidJsonError,
    );
  });

  it("does not silently accept a mock value that fails the schema", async () => {
    const client = createMockLlmClient({ jsonValue: { name: "x" } });
    await expect(inferStructuredIcp(client, intake)).rejects.toBeInstanceOf(
      LlmInvalidJsonError,
    );
  });

  it("accepts the live failing shape after normalization", async () => {
    const client = createMockLlmClient({ jsonValue: failingLiveShape });
    const result = await inferStructuredIcp(client, intake);
    expect(result.structured.targetIndustries[0]?.naics).toBe("488510");
    expect(result.structured.expansionSuggestions[0]?.kind).toBe(
      "ADJACENT_SEGMENT",
    );
  });
});
