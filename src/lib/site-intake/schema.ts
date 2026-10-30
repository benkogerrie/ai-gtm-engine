import { z } from "zod";

const nullableString = z.string().trim().min(1).nullable();
const nullableStringList = z.array(z.string().trim().min(1)).nullable();
const nullableNumber = z.number().finite().nullable();

export const siteIntakeLlmSchema = z.object({
  name: nullableString,
  description: nullableString,
  targetCustomer: nullableString,
  problem: nullableString,
  offering: nullableString,
  features: nullableStringList,
  capabilities: nullableStringList,
  technicalConstraints: nullableStringList,
  existingCustomers: nullableStringList,
  referenceWins: nullableStringList,
  pricingModel: nullableString,
  contractValueMin: nullableNumber,
  contractValueMax: nullableNumber,
  monetizationModel: nullableString,
  freeText: nullableString,
});

export type SiteIntakeLlmFields = z.infer<typeof siteIntakeLlmSchema>;

export const siteReadRequestSchema = z.object({
  url: z.string().trim().min(1),
});

export type SiteReadRequest = z.infer<typeof siteReadRequestSchema>;

export type IntakeFormValues = {
  name: string;
  description: string;
  freeText: string;
  features: string;
  capabilities: string;
  technicalConstraints: string;
  existingCustomers: string;
  referenceWins: string;
  pricingModel: string;
  contractValueMin: string;
  monetizationModel: string;
  contractValueMax: string;
};

export const EMPTY_INTAKE_FORM: IntakeFormValues = {
  name: "",
  description: "",
  freeText: "",
  features: "",
  capabilities: "",
  technicalConstraints: "",
  existingCustomers: "",
  referenceWins: "",
  pricingModel: "",
  contractValueMin: "",
  contractValueMax: "",
  monetizationModel: "",
};

export const INTAKE_FORM_KEYS = [
  "name",
  "description",
  "freeText",
  "features",
  "capabilities",
  "technicalConstraints",
  "existingCustomers",
  "referenceWins",
  "pricingModel",
  "contractValueMin",
  "contractValueMax",
  "monetizationModel",
] as const satisfies ReadonlyArray<keyof IntakeFormValues>;

export type IntakeFormKey = (typeof INTAKE_FORM_KEYS)[number];
