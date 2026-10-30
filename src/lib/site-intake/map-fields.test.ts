import { describe, expect, it } from "vitest";
import {
  applySiteIntake,
  emptyKeysAfterRead,
  ensureWebsiteLine,
  llmFieldsToFormValues,
} from "./map-fields";
import { EMPTY_INTAKE_FORM, type SiteIntakeLlmFields } from "./schema";

const fields: SiteIntakeLlmFields = {
  name: "ShiftPilot",
  description: "AI shift scheduling for hospitals",
  targetCustomer: "Hospital operations leads",
  problem: "Night-shift coverage is planned by hand",
  offering: "Automated rostering",
  features: ["shift scheduling", "overtime reduction"],
  capabilities: ["AI rostering"],
  technicalConstraints: null,
  existingCustomers: null,
  referenceWins: null,
  pricingModel: null,
  contractValueMin: null,
  contractValueMax: 120000,
  monetizationModel: "subscription",
  freeText: null,
};

describe("llmFieldsToFormValues", () => {
  it("maps supported fields and folds narrative extras into free text with the website", () => {
    const form = llmFieldsToFormValues(fields, "https://shiftpilot.example");
    expect(form.name).toBe("ShiftPilot");
    expect(form.description).toBe("AI shift scheduling for hospitals");
    expect(form.features).toBe("shift scheduling\novertime reduction");
    expect(form.contractValueMax).toBe("120000");
    expect(form.contractValueMin).toBe("");
    expect(form.technicalConstraints).toBe("");
    expect(form.freeText).toContain("Offering: Automated rostering");
    expect(form.freeText).toContain("Target customer: Hospital operations leads");
    expect(form.freeText).toContain("Problem / pain: Night-shift coverage is planned by hand");
    expect(form.freeText).toContain("Website: https://shiftpilot.example");
  });
});

describe("applySiteIntake", () => {
  it("fills only empty fields and records skipped keys", () => {
    const current = {
      ...EMPTY_INTAKE_FORM,
      name: "Already named",
      pricingModel: "manual",
    };
    const suggested = llmFieldsToFormValues(fields, "https://shiftpilot.example");
    const applied = applySiteIntake(current, suggested, "empty-only");
    expect(applied.values.name).toBe("Already named");
    expect(applied.values.description).toBe("AI shift scheduling for hospitals");
    expect(applied.inferredKeys).toContain("description");
    expect(applied.skippedKeys).toEqual(["name"]);
  });

  it("replaces filled fields after confirm", () => {
    const current = { ...EMPTY_INTAKE_FORM, name: "Already named" };
    const suggested = llmFieldsToFormValues(fields, "https://shiftpilot.example");
    const applied = applySiteIntake(current, suggested, "replace");
    expect(applied.values.name).toBe("ShiftPilot");
    expect(applied.inferredKeys).toContain("name");
    expect(applied.skippedKeys).toEqual([]);
  });
});

describe("ensureWebsiteLine", () => {
  it("appends Website: url when missing", () => {
    expect(ensureWebsiteLine("We sell software", "https://acme.test")).toBe(
      "We sell software\n\nWebsite: https://acme.test",
    );
    expect(ensureWebsiteLine("Website: https://acme.test", "https://acme.test")).toBe(
      "Website: https://acme.test",
    );
  });
});

describe("emptyKeysAfterRead", () => {
  it("lists fields that still need input", () => {
    const suggested = llmFieldsToFormValues(fields, "https://shiftpilot.example");
    const applied = applySiteIntake(EMPTY_INTAKE_FORM, suggested);
    expect(emptyKeysAfterRead(applied.values)).toEqual([
      "technicalConstraints",
      "existingCustomers",
      "referenceWins",
      "pricingModel",
      "contractValueMin",
    ]);
  });
});
