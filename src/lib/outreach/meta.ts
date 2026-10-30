import {
  outreachDraftMetaSchema,
  type OutreachDraftMeta,
} from "./schema";

export function parseOutreachMeta(
  variant: string | null | undefined,
): OutreachDraftMeta | null {
  if (!variant) {
    return null;
  }
  try {
    const parsed = JSON.parse(variant) as unknown;
    const result = outreachDraftMetaSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function serializeOutreachMeta(meta: OutreachDraftMeta): string {
  return JSON.stringify(meta);
}

export function isLabeledDemo(input: {
  companyName?: string | null;
  companyDomain?: string | null;
  inferenceMode?: string | null;
  demoLabel?: string | null;
}): boolean {
  const name = input.companyName ?? "";
  const domain = (input.companyDomain ?? "").toLowerCase();
  return (
    name.includes("TEST") ||
    name.includes("EXAMPLE") ||
    name.includes("MOCK") ||
    domain === "example.com" ||
    domain.endsWith(".example") ||
    Boolean(input.demoLabel)
  );
}
