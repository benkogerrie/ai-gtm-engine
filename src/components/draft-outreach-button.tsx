import Link from "next/link";

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
    <Link
      href={draftOutreachHref(companyId)}
      className="inline-flex rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]"
    >
      {label}
    </Link>
  );
}
