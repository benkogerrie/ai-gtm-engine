"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const APP_NAV_LINKS = [
  { href: "/intake", label: "Intake" },
  { href: "/icp", label: "ICP" },
  { href: "/prospects", label: "Prospects" },
  { href: "/outreach", label: "Outreach" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function isAppNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Judge flow" className="flex flex-wrap justify-center gap-5 text-sm">
      {APP_NAV_LINKS.map((link) => {
        const active = isAppNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AppNavInner() {
  const pathname = usePathname() ?? "";
  return <NavLinks pathname={pathname} />;
}

function AppNavFallback() {
  return <NavLinks pathname="" />;
}

export function AppNav() {
  return (
    <Suspense fallback={<AppNavFallback />}>
      <AppNavInner />
    </Suspense>
  );
}
