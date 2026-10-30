import Link from "next/link";
import { PRODUCT_MODULES } from "@/lib/modules";

export function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <p className="text-sm font-medium tracking-[0.18em] uppercase">
            AI GTM Engine
          </p>
          <p className="text-xs tracking-wide text-[var(--muted)]">B001 · Public skeleton</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-24">
        <p className="text-xs font-medium tracking-[0.22em] text-[var(--muted)] uppercase">
          Closed-loop go-to-market
        </p>
        <h1 className="font-serif mt-4 max-w-3xl text-4xl leading-tight tracking-tight text-balance sm:text-6xl">
          AI GTM Engine
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)] text-pretty">
          Unify intake, discovery, graph reasoning, verified outreach and pipeline
          analytics into one evidence-backed GTM system.
        </p>

        <section aria-labelledby="modules-heading" className="mt-16">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--rule)] pb-3">
            <h2 id="modules-heading" className="font-serif text-2xl tracking-tight">
              Modules
            </h2>
            <p className="text-xs tracking-wide text-[var(--muted)] uppercase">
              Five operating surfaces
            </p>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRODUCT_MODULES.map((productModule, index) => {
              const href =
                productModule.name === "Discovery" ? "/prospects" : undefined;
              return (
                <li
                  key={productModule.name}
                  className={`rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5 ${
                    index === PRODUCT_MODULES.length - 1 ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-serif text-xl tracking-tight">
                      {href ? (
                        <Link href={href} className="underline-offset-4 hover:underline">
                          {productModule.name}
                        </Link>
                      ) : (
                        productModule.name
                      )}
                    </h3>
                    <span className="shrink-0 rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                      {href ? "Open" : "Coming soon"}
                    </span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                    {productModule.summary}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Standalone buildathon prototype. MIT licensed.</p>
          <p>No shared code, branding, or secrets from other products.</p>
        </div>
      </footer>
    </div>
  );
}
