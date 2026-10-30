import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Stable entry so later /prospects rows can link here with a company id. */
export function draftOutreachHref(companyId: string): string {
  return `/outreach/new?companyId=${encodeURIComponent(companyId)}`;
}

export function DraftOutreachButton({
  companyId,
  label = "Draft outreach",
}: {
  companyId: string;
  label?: string;
}) {
  return (
    <Button asChild size="sm">
      <Link href={draftOutreachHref(companyId)}>{label}</Link>
    </Button>
  );
}
