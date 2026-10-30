import {
  EMPTY_INTAKE_FORM,
  INTAKE_FORM_KEYS,
  type IntakeFormKey,
  type IntakeFormValues,
  type SiteIntakeLlmFields,
} from "./schema";

function joinList(values: string[] | null): string {
  if (!values?.length) {
    return "";
  }
  return values.join("\n");
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

function websiteLine(websiteUrl: string): string {
  return `Website: ${websiteUrl}`;
}

function composeFreeText(
  fields: SiteIntakeLlmFields,
  websiteUrl: string,
): string {
  const blocks: string[] = [];
  if (fields.freeText) {
    blocks.push(fields.freeText.trim());
  }
  if (fields.offering) {
    blocks.push(`Offering: ${fields.offering.trim()}`);
  }
  if (fields.targetCustomer) {
    blocks.push(`Target customer: ${fields.targetCustomer.trim()}`);
  }
  if (fields.problem) {
    blocks.push(`Problem / pain: ${fields.problem.trim()}`);
  }
  const composed = blocks.join("\n\n").trim();
  return ensureWebsiteLine(composed, websiteUrl);
}

export function ensureWebsiteLine(freeText: string, websiteUrl: string): string {
  const line = websiteLine(websiteUrl);
  if (!websiteUrl.trim()) {
    return freeText;
  }
  if (freeText.includes(websiteUrl) || /(^|\n)\s*Website:\s*/i.test(freeText)) {
    return freeText.trim();
  }
  return [freeText.trim(), line].filter(Boolean).join("\n\n");
}

export function llmFieldsToFormValues(
  fields: SiteIntakeLlmFields,
  websiteUrl: string,
): IntakeFormValues {
  return {
    name: fields.name?.trim() ?? "",
    description: fields.description?.trim() ?? "",
    freeText: composeFreeText(fields, websiteUrl),
    features: joinList(fields.features),
    capabilities: joinList(fields.capabilities),
    technicalConstraints: joinList(fields.technicalConstraints),
    existingCustomers: joinList(fields.existingCustomers),
    referenceWins: joinList(fields.referenceWins),
    pricingModel: fields.pricingModel?.trim() ?? "",
    contractValueMin: formatNumber(fields.contractValueMin),
    contractValueMax: formatNumber(fields.contractValueMax),
    monetizationModel: fields.monetizationModel?.trim() ?? "",
  };
}

export function isBlankFormValue(value: string): boolean {
  return value.trim().length === 0;
}

export type ApplySiteIntakeResult = {
  values: IntakeFormValues;
  inferredKeys: IntakeFormKey[];
  skippedKeys: IntakeFormKey[];
};

export function applySiteIntake(
  current: IntakeFormValues,
  suggested: IntakeFormValues,
  mode: "empty-only" | "replace" = "empty-only",
): ApplySiteIntakeResult {
  const values = { ...EMPTY_INTAKE_FORM, ...current };
  const inferredKeys: IntakeFormKey[] = [];
  const skippedKeys: IntakeFormKey[] = [];

  for (const key of INTAKE_FORM_KEYS) {
    const suggestion = suggested[key];
    if (isBlankFormValue(suggestion)) {
      continue;
    }
    const existing = current[key];
    if (mode === "replace" || isBlankFormValue(existing)) {
      values[key] = suggestion;
      inferredKeys.push(key);
    } else {
      skippedKeys.push(key);
    }
  }

  return { values, inferredKeys, skippedKeys };
}

export function emptyKeysAfterRead(values: IntakeFormValues): IntakeFormKey[] {
  return INTAKE_FORM_KEYS.filter((key) => isBlankFormValue(values[key]));
}
