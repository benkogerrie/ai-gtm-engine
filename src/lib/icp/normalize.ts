import { z } from "zod";
import { llmIcpOutputSchema, type LlmIcpOutput } from "@/domain";

const EXPANSION_KIND_ALIASES: Record<string, string> = {
  ADJACENT_SEGMENT: "ADJACENT_SEGMENT",
  ADJACENT: "ADJACENT_SEGMENT",
  ADJACENTSEGMENT: "ADJACENT_SEGMENT",
  EMERGING_VERTICAL: "EMERGING_VERTICAL",
  EMERGING: "EMERGING_VERTICAL",
  EMERGINGVERTICAL: "EMERGING_VERTICAL",
  NEW_VERTICAL: "EMERGING_VERTICAL",
  NON_OBVIOUS_APPLICATION: "NON_OBVIOUS_APPLICATION",
  NON_OBVIOUS: "NON_OBVIOUS_APPLICATION",
  NONOBVIOUS: "NON_OBVIOUS_APPLICATION",
  NONOBVIOUS_APPLICATION: "NON_OBVIOUS_APPLICATION",
  NON_OBVIOUSAPPLICATION: "NON_OBVIOUS_APPLICATION",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) {
        return found;
      }
    }
  }
  const record = asRecord(value);
  if (record) {
    for (const key of ["code", "value", "id", "text", "name", "label"]) {
      const found = firstString(record[key]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function firstNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function pick(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function canonKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function mapExpansionKind(value: unknown): unknown {
  const raw = firstString(value);
  if (!raw) {
    return value;
  }
  return EXPANSION_KIND_ALIASES[canonKey(raw)] ?? raw;
}

function mapTriggerType(value: unknown): unknown {
  const raw = firstString(value);
  if (!raw) {
    return value;
  }
  const key = canonKey(raw);
  if (
    key === "TECH_STACK_CHANGE" ||
    key.includes("TECH") ||
    key.includes("STACK")
  ) {
    return "TECH_STACK_CHANGE";
  }
  if (key === "EXEC_HIRE" || key.includes("HIRE")) {
    return "EXEC_HIRE";
  }
  if (key === "FUNDING" || key.includes("FUND")) {
    return "FUNDING";
  }
  if (key === "OTHER") {
    return "OTHER";
  }
  return raw;
}

function inferredStatus(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return "INFERRED";
  }
  if (typeof value === "string" && value.trim().toUpperCase() === "INFERRED") {
    return "INFERRED";
  }
  return value;
}

function normalizeCode(value: unknown, min: number, max: number): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const raw = firstString(value);
  if (!raw) {
    return value;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= min && digits.length <= max) {
    return digits;
  }
  return raw;
}

function normalizeIndustry(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const name = firstString(
    pick(record, ["name", "industry", "sector", "label", "title"]),
  );
  return {
    ...record,
    name,
    naics: normalizeCode(pick(record, ["naics", "naicsCode", "naics_code"]), 2, 6),
    sic: normalizeCode(pick(record, ["sic", "sicCode", "sic_code"]), 2, 4),
    confidence: record.confidence,
    status: inferredStatus(record.status),
  };
}

function normalizeBand(
  value: unknown,
  fallbackLabel: string,
  parent: Record<string, unknown>,
): unknown {
  const record = asRecord(value) ?? {};
  const min = firstNumber(pick(record, ["min", "minimum", "from", "low"]));
  const max = firstNumber(pick(record, ["max", "maximum", "to", "high"]));
  const label =
    firstString(pick(record, ["label", "name", "range", "title"])) ??
    (min != null || max != null
      ? [min, max].filter((part) => part != null).join("–")
      : undefined);
  if (!label && min == null && max == null) {
    return value;
  }
  return {
    ...record,
    label: label ?? fallbackLabel,
    min: min ?? null,
    max: max ?? null,
    currency: firstString(record.currency) ?? "USD",
    confidence: record.confidence ?? parent.confidence,
    status: inferredStatus(record.status ?? parent.status),
  };
}

function normalizeCompanySize(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const rawTiers = pick(record, [
    "headcountTiers",
    "headcount_tiers",
    "headcounts",
    "employeeTiers",
  ]);
  let headcountTiers: unknown = rawTiers;
  if (Array.isArray(rawTiers)) {
    headcountTiers = rawTiers.map((tier) =>
      normalizeBand(tier, "headcount", record),
    );
  } else {
    const nested =
      asRecord(record.headcount) ??
      asRecord(record.employees) ??
      asRecord(record.size);
    const min = firstNumber(
      pick(record, ["companySizeMin", "headcountMin", "minEmployees", "min"]) ??
        nested?.min,
    );
    const max = firstNumber(
      pick(record, ["companySizeMax", "headcountMax", "maxEmployees", "max"]) ??
        nested?.max,
    );
    const label = firstString(
      pick(record, ["headcountLabel"]) ?? nested?.label,
    );
    if (min != null || max != null || label || asRecord(rawTiers)) {
      headcountTiers = [
        normalizeBand(
          asRecord(rawTiers) ?? {
            label,
            min,
            max,
          },
          "headcount",
          record,
        ),
      ];
    }
  }

  const rawBands = pick(record, [
    "revenueBands",
    "revenue_bands",
    "revenues",
  ]);
  let revenueBands: unknown = rawBands;
  if (Array.isArray(rawBands)) {
    revenueBands = rawBands.map((band) => normalizeBand(band, "revenue", record));
  } else {
    const nested = asRecord(record.revenue) ?? asRecord(record.revenueBand);
    const min = firstNumber(
      pick(record, ["revenueBandMin", "revenueMin", "minRevenue"]) ?? nested?.min,
    );
    const max = firstNumber(
      pick(record, ["revenueBandMax", "revenueMax", "maxRevenue"]) ?? nested?.max,
    );
    const label = firstString(pick(record, ["revenueLabel"]) ?? nested?.label);
    if (min != null || max != null || label || asRecord(rawBands)) {
      revenueBands = [
        normalizeBand(
          asRecord(rawBands) ?? { label, min, max },
          "revenue",
          record,
        ),
      ];
    }
  }

  return {
    ...record,
    headcountTiers,
    revenueBands,
    confidence: record.confidence,
    status: inferredStatus(record.status),
  };
}

function normalizePersona(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  return {
    ...record,
    title: firstString(pick(record, ["title", "role", "name"])),
    functionalArea: firstString(
      pick(record, ["functionalArea", "function", "area", "department"]),
    ),
    seniority: firstString(pick(record, ["seniority", "level"])),
    confidence: record.confidence,
    status: inferredStatus(record.status),
  };
}

function normalizeTrigger(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  return {
    ...record,
    type: mapTriggerType(pick(record, ["type", "kind", "category"])),
    summary: firstString(
      pick(record, ["summary", "description", "event", "text", "trigger"]),
    ),
    confidence: record.confidence,
    status: inferredStatus(record.status),
  };
}

function normalizeEvidence(value: unknown): unknown {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (!Array.isArray(value)) {
    const single = firstString(value);
    return single ? [single] : [];
  }
  return value
    .map((item) => firstString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeExpansion(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  return {
    ...record,
    kind: mapExpansionKind(pick(record, ["kind", "type", "category", "segment"])),
    title: firstString(pick(record, ["title", "name", "label", "headline"])),
    reasoning: firstString(
      pick(record, ["reasoning", "reason", "rationale", "why"]),
    ),
    evidence: normalizeEvidence(record.evidence),
    confidence: record.confidence,
    status: inferredStatus(record.status),
  };
}

function asList(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Shape-only coercion for model output. Maps aliases and array-vs-string
 * mistakes. Does not invent names, summaries, titles, or evidence text.
 */
export function normalizeLlmIcpOutput(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const industries = asList(
    pick(record, ["targetIndustries", "industries", "target_industries"]),
  );
  const personas = asList(
    pick(record, ["buyerPersonas", "personas", "buyers"]),
  );
  const triggers = asList(
    pick(record, ["triggerEvents", "triggers", "trigger_events"]),
  );
  const expansions = asList(
    pick(record, ["expansionSuggestions", "expansions", "expansion_suggestions"]),
  );

  return {
    ...record,
    name: firstString(pick(record, ["name", "icpName", "title"])),
    targetIndustries: Array.isArray(industries)
      ? industries.map(normalizeIndustry)
      : industries,
    companySize: normalizeCompanySize(record.companySize),
    buyerPersonas: Array.isArray(personas)
      ? personas.map(normalizePersona)
      : personas,
    triggerEvents: Array.isArray(triggers)
      ? triggers.map(normalizeTrigger)
      : triggers,
    expansionSuggestions: Array.isArray(expansions)
      ? expansions.map(normalizeExpansion)
      : expansions,
  };
}

export const llmIcpOutputNormalizedSchema: z.ZodType<LlmIcpOutput> = z.preprocess(
  (value) => normalizeLlmIcpOutput(value),
  llmIcpOutputSchema,
);
