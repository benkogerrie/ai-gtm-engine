import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { discoveryInputFromIcp } from "@/lib/discovery/adapter";
import { runDiscovery } from "@/lib/discovery/pipeline";
import { approveIcp, submitProductIntake } from "@/lib/icp/service";
import { createDeepSeekLlmClient } from "@/lib/llm";
import { createBraveSearchClient } from "@/lib/search";
import {
  approveOutreachDraft,
  draftOutreachForCompany,
  sendOutreachDryRun,
} from "@/lib/outreach";

const hasBrave = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());
const hasLlm = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
const hasLiveKeys = hasBrave && hasLlm;

const orgId = "11111111-1111-4111-8111-111111111111";
const human = { actorType: "human" as const, actorId: "live-judge" };
const agent = { actorType: "agent" as const, actorId: "live-engine" };

describe("live judge flow", () => {
  let handle: DatabaseHandle | undefined;

  beforeEach(async () => {
    if (!hasLiveKeys) {
      return;
    }
    handle = await createTestDatabase();
    await createOrganization(
      handle.db,
      { id: orgId, name: "Live judge workspace" },
      agent,
    );
  });

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = undefined;
    }
  });

  it.skipIf(!hasLiveKeys)(
    "runs ICP → discovery → draft → approve → dry-run without a real send or MOCK label",
    async () => {
      const db = handle!.db;
      const llm = createDeepSeekLlmClient();

      const submitted = await submitProductIntake(
        db,
        {
          name: "ShiftPilot",
          description:
            "AI shift scheduling for hospitals and clinics that need nurse staffing coverage",
          features: ["shift scheduling"],
          capabilities: ["nurse staffing coverage"],
        },
        { orgId, actor: agent },
        llm,
      );
      const approved = await approveIcp(db, submitted.icp.id, {
        orgId,
        actor: human,
      });
      expect(approved.status).toBe("APPROVED");

      const input = discoveryInputFromIcp({
        icpId: approved.id,
        productSummary: submitted.product.description,
        structured: submitted.structured,
      });
      const run = await runDiscovery(input, {
        db,
        orgId,
        actor: agent,
        search: createBraveSearchClient(),
        llm,
      });
      expect(run.mode).toBe("LIVE");
      expect(run.status).toBe("completed");
      const prospect = run.prospects.find((item) => item.companyId);
      expect(prospect?.companyId).toBeTruthy();
      expect(prospect?.name).not.toMatch(/TEST|EXAMPLE|MOCK/i);

      const drafted = await draftOutreachForCompany(
        db,
        { companyId: prospect!.companyId!, tone: "professional", cta: "book a call" },
        { orgId, actor: human },
        llm,
      );
      expect(drafted.labeledTest).toBe(false);
      expect(drafted.demo).toBe(false);
      expect(drafted.inferenceMode).toBe("live");
      expect(drafted.dryRun).toBe(true);
      expect(drafted.sentAt).toBeNull();

      const approvedDraft = await approveOutreachDraft(db, drafted.id, {
        orgId,
        actor: human,
      });
      expect(approvedDraft.status).toBe("APPROVED");

      const dryRun = await sendOutreachDryRun(db, drafted.id, {
        orgId,
        actor: human,
      });
      expect(dryRun.status).toBe("DRY_RUN_COMPLETED");
      expect(dryRun.status).not.toBe("SENT");
      expect(dryRun.dryRun).toBe(true);
      expect(dryRun.sentAt).toBeNull();
      expect(dryRun.labeledTest).toBe(false);
    },
    180_000,
  );

  it("skips cleanly when BRAVE_SEARCH_API_KEY or DEEPSEEK_API_KEY is unset", () => {
    expect(typeof hasLiveKeys).toBe("boolean");
  });
});
