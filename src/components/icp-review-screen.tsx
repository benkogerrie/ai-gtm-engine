"use client";

import { useState } from "react";
import Link from "next/link";
import type { StructuredIcp } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type ReviewIcp = {
  id: string;
  name: string;
  status: string;
  version: number;
  inferenceMode: string;
  structured: StructuredIcp;
};

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <Badge variant="inferred">
      {value.toFixed(2)} · INFERRED
    </Badge>
  );
}

export function IcpReviewScreen({
  icp,
  productName,
  onApprove,
  onDecide,
  onSave,
  onFindProspects,
}: {
  icp: ReviewIcp;
  productName: string;
  onApprove?: (id: string) => Promise<{ error?: string }>;
  onFindProspects?: (
    id: string,
  ) => Promise<{ error?: string } | void>;
  onDecide?: (input: {
    icpId: string;
    suggestionId: string;
    decision: "ACCEPTED" | "ADJUSTED" | "DISMISSED";
    note?: string;
  }) => Promise<{ error?: string }>;
  onSave?: (
    id: string,
    edit: { name: string },
  ) => Promise<{ error?: string }>;
}) {
  const structured = icp.structured;
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(structured.name);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustNote, setAdjustNote] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function run(
    work: () => Promise<{ error?: string } | void>,
    action?: string,
  ) {
    setPending(true);
    setPendingAction(action ?? null);
    setError(null);
    try {
      const result = await work();
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  }

  const findingProspects = pending && pendingAction === "find";

  return (
    <div className="space-y-8">
      {icp.inferenceMode === "mock" ? (
        <p
          data-testid="mock-banner"
          className="rounded-md border border-accent bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          MOCK output — generated without DEEPSEEK_API_KEY.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase">
            {productName} · v{icp.version} · {icp.status}
          </p>
          <h1 className="font-serif mt-2 text-3xl tracking-tight">{structured.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {icp.status === "DRAFT" && onApprove ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => onApprove(icp.id), "approve")}
            >
              {pending && pendingAction === "approve" ? (
                <>
                  <Spinner />
                  Approving…
                </>
              ) : (
                "Approve ICP"
              )}
            </Button>
          ) : (
            <Badge variant="outline">{icp.status}</Badge>
          )}
          {icp.status === "APPROVED" && onFindProspects ? (
            <Button
              type="button"
              disabled={pending}
              aria-busy={findingProspects}
              onClick={() => run(() => onFindProspects(icp.id), "find")}
            >
              {findingProspects ? (
                <>
                  <Spinner />
                  Finding prospects…
                </>
              ) : (
                "Find prospects"
              )}
            </Button>
          ) : null}
          {icp.status === "APPROVED" ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard?icp=${icp.id}`}>Dashboard</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {findingProspects ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Finding prospects… searching public sources for cited buyer organizations.
        </p>
      ) : null}

      {onSave ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onSave(icp.id, { name }), "save");
          }}
        >
          <Label className="min-w-64 flex-1">
            <span className="text-muted-foreground">ICP name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1"
            />
          </Label>
          <Button type="submit" variant="outline" disabled={pending}>
            Save edit
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="font-serif text-xl tracking-tight">Target industries</h2>
        <ul className="mt-3 space-y-2">
          {structured.targetIndustries.map((industry) => (
            <li key={`${industry.naics}-${industry.name}`}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {industry.naics ? `${industry.naics} · ` : ""}
                      {industry.name}
                    </p>
                    <ConfidenceBadge value={industry.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SIC {industry.sic ?? "—"}
                    {industry.naics
                      ? industry.naicsValidation.known
                        ? ` · NAICS known${industry.naicsValidation.label ? ` (${industry.naicsValidation.label})` : ""}`
                        : " · NAICS flagged unknown (not invented)"
                      : " · no NAICS"}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Company size</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {structured.companySize.headcountTiers.map((tier) => (
            <Card key={tier.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p>Headcount {tier.label}</p>
                  <ConfidenceBadge value={tier.confidence} />
                </div>
              </CardContent>
            </Card>
          ))}
          {structured.companySize.revenueBands.map((band) => (
            <Card key={band.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p>Revenue {band.label}</p>
                  <ConfidenceBadge value={band.confidence} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Buyer personas</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {structured.buyerPersonas.map((persona) => (
            <li key={`${persona.title}-${persona.seniority}`}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{persona.title}</p>
                    <ConfidenceBadge value={persona.confidence} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {persona.functionalArea} · {persona.seniority}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Trigger events</h2>
        <ul className="mt-3 space-y-2">
          {structured.triggerEvents.map((event) => (
            <li key={event.summary}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <p>
                    <span className="text-xs tracking-wide text-muted-foreground uppercase">
                      {event.type}
                    </span>
                    <span className="mt-1 block">{event.summary}</span>
                  </p>
                  <ConfidenceBadge value={event.confidence} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Expansion suggestions</h2>
        <ul className="mt-3 space-y-3">
          {structured.expansionSuggestions.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <ConfidenceBadge value={item.confidence} />
                  </div>
                  <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                    {item.kind} · {item.decision}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.reasoning}
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                    {item.evidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                  {onDecide && item.decision === "PENDING" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            onDecide({
                              icpId: icp.id,
                              suggestionId: item.id,
                              decision: "ACCEPTED",
                            }),
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setAdjusting(item.id);
                          setAdjustNote("");
                        }}
                      >
                        Adjust
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            onDecide({
                              icpId: icp.id,
                              suggestionId: item.id,
                              decision: "DISMISSED",
                            }),
                          )
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                  {adjusting === item.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={adjustNote}
                        onChange={(event) => setAdjustNote(event.target.value)}
                        placeholder="Adjustment note"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !adjustNote.trim()}
                        onClick={() =>
                          run(async () => {
                            const result = await onDecide?.({
                              icpId: icp.id,
                              suggestionId: item.id,
                              decision: "ADJUSTED",
                              note: adjustNote.trim(),
                            });
                            setAdjusting(null);
                            return result ?? {};
                          })
                        }
                      >
                        Save adjustment
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
