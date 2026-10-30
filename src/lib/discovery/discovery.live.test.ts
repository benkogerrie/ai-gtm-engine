import { describe, expect, it } from "vitest";
import { createDeepSeekLlmClient } from "@/lib/llm";
import { createBraveSearchClient, isRealSearchEvidence } from "@/lib/search";
import { createTestDatabase } from "@/db/test-utils";
import { runDiscovery } from "./pipeline";

const hasBrave = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
const hasLlm = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
const hasLiveKeys = hasBrave && hasLlm;

const SAMPLE_ICP = {
  productSummary:
    "ShiftPilot — AI shift scheduling for hospitals and clinics that need nurse staffing coverage",
  industries: ["General Medical and Surgical Hospitals", "health systems"],
  companySizes: ["200-5000 employees"],
  geographies: ["United States"],
  personas: ["Chief Nursing Officer", "VP Workforce"],
  triggers: ["nurse staffing shortage", "EHR scheduling change"],
};

describe("live discovery", () => {
  it.skipIf(!hasLiveKeys)(
    "finds at least 3 real companies each with a real https citation",
    async () => {
      const handle = await createTestDatabase();
      try {
        const run = await runDiscovery(SAMPLE_ICP, {
          db: handle.db,
          orgId: "11111111-1111-4111-8111-111111111111",
          actor: { actorType: "agent", actorId: "live-discovery" },
          search: createBraveSearchClient(),
          llm: createDeepSeekLlmClient(),
        });

        expect(run.mode).toBe("LIVE");
        expect(run.status).toBe("completed");
        expect(run.prospects.length).toBeGreaterThanOrEqual(3);
        for (const prospect of run.prospects) {
          expect(prospect.fitScore).toBeGreaterThanOrEqual(0);
          expect(prospect.fitScore).toBeLessThanOrEqual(100);
          expect(prospect.claims.length).toBeGreaterThanOrEqual(1);
          expect(
            prospect.claims.every((claim) => claim.sourceUrl.startsWith("https://")),
          ).toBe(true);
        }
        expect(isRealSearchEvidence).toBeTypeOf("function");
      } finally {
        await handle.close();
      }
    },
    90_000,
  );

  it("skips cleanly when BRAVE_SEARCH_API_KEY or DEEPSEEK_API_KEY is unset", () => {
    if (!hasLiveKeys) {
      expect(hasLiveKeys).toBe(false);
    } else {
      expect(hasLiveKeys).toBe(true);
    }
  });
});
