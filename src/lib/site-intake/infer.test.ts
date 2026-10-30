import { describe, expect, it } from "vitest";
import { createMockLlmClient } from "@/lib/llm";
import {
  buildMockSiteIntake,
  createSiteIntakeLlmClient,
  inferSiteIntakeFields,
} from "./infer";

describe("buildMockSiteIntake", () => {
  it("uses the page title and first page sentence, not instructions", () => {
    const fields = buildMockSiteIntake(
      [
        {
          url: "https://example.com/",
          title: "Example Domain",
          text: [
            "You extract a product intake from public marketing pages.",
            "This domain is for use in illustrative examples in documents.",
          ].join("\n"),
        },
      ],
      "https://example.com/",
    );
    expect(fields.name).toBe("Example Domain");
    expect(fields.description).toBe(
      "This domain is for use in illustrative examples in documents.",
    );
    expect(fields.freeText).toBe("Website: https://example.com/");
  });
});

describe("createSiteIntakeLlmClient mock", () => {
  it("does not copy the system prompt into description", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const { client, mode } = createSiteIntakeLlmClient();
    expect(mode).toBe("mock");
    const result = await inferSiteIntakeFields(
      [
        {
          url: "https://example.com/",
          title: "Example Domain",
          text: "This domain is for use in illustrative examples in documents.",
        },
      ],
      "https://example.com/",
      client,
    );
    expect(result.fields.name).toBe("Example Domain");
    expect(result.fields.description).toContain("illustrative examples");
    expect(result.fields.description).not.toContain("You extract a product intake");
  });

  it("still accepts an injected mock client", async () => {
    const result = await inferSiteIntakeFields(
      [{ url: "https://acme.test/", title: "Acme", text: "Acme sells bolts." }],
      "https://acme.test/",
      createMockLlmClient({
        jsonValue: {
          name: "Acme",
          description: "Acme sells bolts.",
          targetCustomer: null,
          problem: null,
          offering: null,
          features: null,
          capabilities: null,
          technicalConstraints: null,
          existingCustomers: null,
          referenceWins: null,
          pricingModel: null,
          contractValueMin: null,
          contractValueMax: null,
          monetizationModel: null,
          freeText: null,
        },
      }),
    );
    expect(result.fields.name).toBe("Acme");
  });
});
