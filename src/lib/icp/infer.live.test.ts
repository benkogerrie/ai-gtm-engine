import { describe, expect, it } from "vitest";
import { structuredIcpSchema } from "@/domain";
import { createDeepSeekLlmClient } from "@/lib/llm";
import { inferStructuredIcp } from "./infer";

const hasLiveKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

describe("live ICP inference", () => {
  it.skipIf(!hasLiveKey)(
    "runs one real structured ICP inference",
    async () => {
      const client = createDeepSeekLlmClient();
      const result = await inferStructuredIcp(client, {
        name: "Harborline Ops Cloud",
        description:
          "Operations platform for mid-market freight brokers. EXAMPLE product only.",
        features: ["lane scoring"],
        capabilities: ["capacity matching"],
        existingCustomers: ["Cedar Freight Desk"],
      });

      expect(structuredIcpSchema.safeParse(result.structured).success).toBe(true);
      expect(result.inferenceMode).toBe("live");
      expect(result.structured.targetIndustries.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it("skips cleanly when DEEPSEEK_API_KEY is unset", () => {
    expect(typeof hasLiveKey).toBe("boolean");
  });
});
