import Link from "next/link";

export const APP_NAV_LINKS = [
  { href: "/intake", label: "Intake" },
  { href: "/icp", label: "ICP" },
  { href: "/prospects", label: "Prospects" },
  { href: "/outreach", label: "Outreach" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function AppNav() {
  return (
    <nav aria-label="Judge flow" className="flex flex-wrap items-center gap-4">
      {APP_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-xs tracking-wide text-[var(--muted)] uppercase hover:text-[var(--foreground)]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
