import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("truncate text-lg font-medium", className)}
    >
      AI GTM Engine
      <span className="text-primary">.ai</span>
    </Link>
  );
}

export function AppTopBar({
  trailing,
}: {
  trailing?: ReactNode;
}) {
  return (
    <header className="shrink-0 px-4 pt-4 pb-3 sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <BrandMark />
        <div className="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-center">
          <AppNav />
        </div>
        <div className="flex items-center justify-end gap-3 sm:order-last">
          {trailing}
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  eyebrow,
  showLogout = false,
  wide = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  showLogout?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <AppTopBar
        trailing={
          showLogout ? (
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Log out
              </Button>
            </form>
          ) : null
        }
      />
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 py-8 sm:px-5",
          wide ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        {eyebrow ? (
          <p className="mb-3 text-xs text-muted-foreground">{eyebrow}</p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
