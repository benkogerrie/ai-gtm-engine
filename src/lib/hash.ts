import { createHash } from "node:crypto";

export function hashCitationContent(sourceUrl: string, quote: string): string {
  return createHash("sha256").update(`${sourceUrl}\n${quote}`).digest("hex");
}
