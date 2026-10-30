import Link from "next/link";
import { AppTopBar } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_MODULES } from "@/lib/modules";

export function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <AppTopBar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-5 sm:py-24">
        <p className="text-xs text-muted-foreground">
          Closed-loop go-to-market
        </p>
        <h1 className="font-serif mt-4 max-w-3xl text-4xl leading-tight tracking-tight text-balance sm:text-6xl">
          AI GTM Engine
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          Unify intake, discovery, graph reasoning, verified outreach and pipeline
          analytics into one evidence-backed GTM system.
        </p>

        <section aria-labelledby="modules-heading" className="mt-16">
          <div className="flex items-end justify-between gap-4 border-b pb-3">
            <h2 id="modules-heading" className="font-serif text-2xl tracking-tight">
              Modules
            </h2>
            <p className="text-xs text-muted-foreground">Five operating surfaces</p>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRODUCT_MODULES.map((productModule, index) => {
              const href =
                productModule.name === "Discovery"
                  ? "/prospects"
                  : productModule.name === "Intake & ICP"
                    ? "/intake"
                    : productModule.name === "Pipeline Dashboard"
                      ? "/dashboard"
                    : productModule.name === "Enrichment & Outreach"
                      ? "/outreach"
                      : undefined;
              return (
                <li
                  key={productModule.name}
                  className={index === PRODUCT_MODULES.length - 1 ? "sm:col-span-2" : ""}
                >
                  <Card className="h-full rounded-lg">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-serif text-xl tracking-tight">
                          {href ? (
                            <Link
                              href={href}
                              className="underline-offset-4 hover:underline"
                            >
                              {productModule.name}
                            </Link>
                          ) : (
                            productModule.name
                          )}
                        </h3>
                        <Badge variant={href ? "verified" : "outline"}>
                          {href ? "Open" : "Coming soon"}
                        </Badge>
                      </div>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {productModule.summary}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>Standalone buildathon prototype. MIT licensed.</p>
          <p>No shared code, branding, or secrets from other products.</p>
        </div>
      </footer>
    </div>
  );
}
