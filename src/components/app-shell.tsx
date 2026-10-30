import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";

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
      <header className="border-b border-[var(--rule)]">
        <div
          className={`mx-auto flex w-full items-center justify-between px-6 py-5 ${
            wide ? "max-w-6xl" : "max-w-5xl"
          }`}
        >
          <Link href="/" className="text-sm font-medium tracking-[0.18em] uppercase">
            AI GTM Engine
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            {eyebrow ? (
              <p className="text-xs tracking-wide text-[var(--muted)]">{eyebrow}</p>
            ) : null}
            <AppNav />
            {showLogout ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-xs tracking-wide text-[var(--muted)] uppercase hover:text-[var(--foreground)]"
                >
                  Log out
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <main
        className={`mx-auto flex w-full flex-1 flex-col px-6 py-10 ${
          wide ? "max-w-6xl" : "max-w-5xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
