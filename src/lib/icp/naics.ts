import type { z } from "zod";
import type { naicsValidationSchema } from "@/domain";
import {
  NAICS_2022_SECTORS,
  NAICS_2022_SOURCE_URL,
  NAICS_2022_SUBSECTORS,
} from "./naics-2022";

export { NAICS_2022_SOURCE_URL };

export type NaicsValidation = z.infer<typeof naicsValidationSchema>;

const NAICS_FORMAT = /^\d{2,6}$/;

const byCode = new Map<string, string>(
  [...NAICS_2022_SECTORS, ...NAICS_2022_SUBSECTORS].map((entry) => [
    entry.code,
    entry.title,
  ]),
);

function sectorPrefix(code: string): string {
  if (code.startsWith("31") || code.startsWith("32") || code.startsWith("33")) {
    return code.slice(0, 2);
  }
  if (code.startsWith("44") || code.startsWith("45")) {
    return code.slice(0, 2);
  }
  if (code.startsWith("48") || code.startsWith("49")) {
    return code.slice(0, 2);
  }
  return code.slice(0, 2);
}

export function validateNaics(code: string | null | undefined): NaicsValidation {
  if (!code) {
    return { formatValid: false, known: false, label: null };
  }
  if (!NAICS_FORMAT.test(code)) {
    return { formatValid: false, known: false, label: null };
  }

  const exact = byCode.get(code);
  if (exact) {
    return { formatValid: true, known: true, label: exact };
  }

  const three = code.length >= 3 ? byCode.get(code.slice(0, 3)) : undefined;
  if (three) {
    return { formatValid: true, known: true, label: three };
  }

  const sector = byCode.get(sectorPrefix(code));
  if (sector) {
    return { formatValid: true, known: true, label: sector };
  }

  return { formatValid: true, known: false, label: null };
}

export function formatNaicsPromptList(): string {
  return NAICS_2022_SECTORS.map((entry) => `${entry.code} ${entry.title}`).join(
    "\n",
  );
}
