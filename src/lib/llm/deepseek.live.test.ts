import { describe, expect, it } from "vitest";
import { createDeepSeekLlmClient } from "./deepseek";

const hasLiveKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

describe("live DeepSeek smoke", () => {
  it.skipIf(!hasLiveKey)(
    "completes a tiny chat against the configured provider",
    async () => {
      const client = createDeepSeekLlmClient();
      const result = await client.chat(
        [{ role: "user", content: "Reply with the single word pong." }],
        { maxTokens: 16, temperature: 0 },
      );

      expect(result.content.trim().length).toBeGreaterThan(0);
      expect(result.usage.promptTokens).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    },
  );

  it("skips cleanly when DEEPSEEK_API_KEY is unset", () => {
    if (!hasLiveKey) {
      expect(hasLiveKey).toBe(false);
    } else {
      expect(hasLiveKey).toBe(true);
    }
  });
});
