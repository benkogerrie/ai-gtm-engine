import { z } from "zod";
import {
  llmOutreachDraftSchema,
  outreachCtaSchema,
  outreachToneSchema,
  type LlmOutreachDraft,
  type OutreachCta,
  type OutreachTone,
} from "./schema";

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
  return undefined;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  const canon = new Map(
    Object.keys(record).map((key) => [
      key.toLowerCase().replace(/[\s_-]+/g, ""),
      record[key],
    ]),
  );
  for (const key of keys) {
    const hit = canon.get(key.toLowerCase().replace(/[\s_-]+/g, ""));
    if (hit !== undefined && hit !== null && hit !== "") {
      return hit;
    }
  }
  return undefined;
}

function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => firstString(item))
    .filter((item): item is string => Boolean(item));
}

function canonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function normalizeOutreachTone(value: unknown): OutreachTone | undefined {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }
  const key = canonKey(raw);
  if (key === "professional" || key === "formal") {
    return "professional";
  }
  if (key === "friendly" || key === "warm" || key === "casual") {
    return "friendly";
  }
  if (key === "direct" || key === "blunt" || key === "concise") {
    return "direct";
  }
  const parsed = outreachToneSchema.safeParse(key);
  return parsed.success ? parsed.data : undefined;
}

export function normalizeOutreachCta(value: unknown): OutreachCta | undefined {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }
  const key = canonKey(raw);
  if (
    key === "book a call" ||
    key === "bookacall" ||
    key === "schedule a call" ||
    key === "book call"
  ) {
    return "book a call";
  }
  if (key === "reply" || key === "respond" || key === "write back") {
    return "reply";
  }
  if (key === "learn more" || key === "learnmore" || key === "read more") {
    return "learn more";
  }
  const parsed = outreachCtaSchema.safeParse(key);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Shape-only coercion for model output. Maps aliases and enum case.
 * Does not invent subject, body, or LinkedIn copy.
 */
export function normalizeOutreachLlmOutput(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const tone = normalizeOutreachTone(pick(record, ["tone", "voice"]));
  const cta = normalizeOutreachCta(
    pick(record, ["cta", "callToAction", "call_to_action"]),
  );

  return {
    ...record,
    emailSubject: firstString(
      pick(record, ["emailSubject", "subject", "email_subject", "title"]),
    ),
    emailBody: firstString(
      pick(record, ["emailBody", "body", "email_body", "email"]),
    ),
    linkedinMessage: firstString(
      pick(record, [
        "linkedinMessage",
        "linkedin",
        "linkedin_message",
        "linkedinBody",
      ]),
    ),
    tone,
    cta,
    citedSignalIds: asStringList(
      pick(record, ["citedSignalIds", "cited_signal_ids", "signalIds"]),
    ),
    sourceUrls: asStringList(
      pick(record, ["sourceUrls", "source_urls", "sources", "urls"]),
    ),
  };
}

export const llmOutreachDraftNormalizedSchema: z.ZodType<LlmOutreachDraft> =
  z.preprocess((value) => normalizeOutreachLlmOutput(value), llmOutreachDraftSchema);
