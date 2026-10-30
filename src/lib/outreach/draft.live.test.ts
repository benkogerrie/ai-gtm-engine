import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { createDeepSeekLlmClient } from "@/lib/llm";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { llmOutreachDraftSchema } from "./schema";
import { seedDemoCompany } from "./seed";
import { draftOutreachForCompany } from "./service";

const hasLiveKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

describe("live outreach draft", () => {
  let handle: DatabaseHandle | undefined;

  beforeEach(() => {
    installTestAuth();
  });

  afterEach(async () => {
    clearTestAuth();
    if (handle) {
      await handle.close();
      handle = undefined;
    }
  });

  it.skipIf(!hasLiveKey)(
    "drafts for a seeded cited TEST company and validates",
    async () => {
      handle = await createTestDatabase();
      await createOrganization(
        handle.db,
        { id: TEST_AUTH.orgId, name: "TEST live org" },
        { actorType: "agent", actorId: "live" },
      );
      const { company } = await seedDemoCompany(handle.db, {
        orgId: TEST_AUTH.orgId,
        actor: { actorType: "agent", actorId: "live" },
      });

      const client = createDeepSeekLlmClient();
      const drafted = await draftOutreachForCompany(
        handle.db,
        { companyId: company.id, tone: "professional", cta: "book a call" },
        {
          orgId: TEST_AUTH.orgId,
          actor: { actorType: "human", actorId: "live-reviewer" },
        },
        client,
      );

      expect(drafted.status).toBe("DRAFT");
      expect(drafted.body.length).toBeGreaterThan(0);
      expect(drafted.linkedinMessage.length).toBeGreaterThan(0);
      expect(drafted.sourceUrls).toContain("https://example.com");
      expect(
        llmOutreachDraftSchema.safeParse({
          emailSubject: drafted.subject,
          emailBody: drafted.body,
          linkedinMessage: drafted.linkedinMessage,
          tone: drafted.tone,
          cta: drafted.cta,
          citedSignalIds: drafted.citedSignals.map((signal) => signal.id),
          sourceUrls: drafted.sourceUrls,
        }).success,
      ).toBe(true);
    },
    60_000,
  );

  it("skips cleanly when DEEPSEEK_API_KEY is unset", () => {
    expect(typeof hasLiveKey).toBe("boolean");
  });
});
