"use client";

import { useState } from "react";
import type { StructuredIcp } from "@/domain";

export type ReviewIcp = {
  id: string;
  name: string;
  status: string;
  version: number;
  inferenceMode: string;
  structured: StructuredIcp;
};

function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 0.75
      ? "border-emerald-300 text-emerald-800"
      : value >= 0.5
        ? "border-amber-300 text-amber-800"
        : "border-[var(--rule)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${tone}`}
    >
      {value.toFixed(2)} · INFERRED
    </span>
  );
}

export function IcpReviewScreen({
  icp,
  productName,
  onApprove,
  onDecide,
  onSave,
}: {
  icp: ReviewIcp;
  productName: string;
  onApprove?: (id: string) => Promise<{ error?: string }>;
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

  async function run(work: () => Promise<{ error?: string } | void>) {
    setPending(true);
    setError(null);
    try {
      const result = await work();
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {icp.inferenceMode === "mock" ? (
        <p
          data-testid="mock-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
        >
          MOCK output — generated without DEEPSEEK_API_KEY.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
            {productName} · v{icp.version} · {icp.status}
          </p>
          <h1 className="font-serif mt-2 text-3xl tracking-tight">{structured.name}</h1>
        </div>
        {icp.status === "DRAFT" && onApprove ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => onApprove(icp.id))}
            className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
          >
            Approve ICP
          </button>
        ) : (
          <span className="rounded-full border border-[var(--rule)] px-3 py-1 text-xs uppercase">
            {icp.status}
          </span>
        )}
      </div>

      {onSave ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onSave(icp.id, { name }));
          }}
        >
          <label className="block min-w-64 flex-1 text-sm">
            <span className="text-[var(--muted)]">ICP name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
          >
            Save edit
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="font-serif text-xl tracking-tight">Target industries</h2>
        <ul className="mt-3 space-y-2">
          {structured.targetIndustries.map((industry) => (
            <li
              key={`${industry.naics}-${industry.name}`}
              className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {industry.naics ? `${industry.naics} · ` : ""}
                  {industry.name}
                </p>
                <ConfidenceBadge value={industry.confidence} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                SIC {industry.sic ?? "—"}
                {industry.naics
                  ? industry.naicsValidation.known
                    ? ` · NAICS known${industry.naicsValidation.label ? ` (${industry.naicsValidation.label})` : ""}`
                    : " · NAICS flagged unknown (not invented)"
                  : " · no NAICS"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Company size</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {structured.companySize.headcountTiers.map((tier) => (
            <div
              key={tier.label}
              className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p>Headcount {tier.label}</p>
                <ConfidenceBadge value={tier.confidence} />
              </div>
            </div>
          ))}
          {structured.companySize.revenueBands.map((band) => (
            <div
              key={band.label}
              className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p>Revenue {band.label}</p>
                <ConfidenceBadge value={band.confidence} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Buyer personas</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {structured.buyerPersonas.map((persona) => (
            <li
              key={`${persona.title}-${persona.seniority}`}
              className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{persona.title}</p>
                <ConfidenceBadge value={persona.confidence} />
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {persona.functionalArea} · {persona.seniority}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Trigger events</h2>
        <ul className="mt-3 space-y-2">
          {structured.triggerEvents.map((event) => (
            <li
              key={event.summary}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <p>
                <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
                  {event.type}
                </span>
                <span className="mt-1 block">{event.summary}</span>
              </p>
              <ConfidenceBadge value={event.confidence} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl tracking-tight">Expansion suggestions</h2>
        <ul className="mt-3 space-y-3">
          {structured.expansionSuggestions.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-[var(--rule)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <ConfidenceBadge value={item.confidence} />
              </div>
              <p className="mt-1 text-xs tracking-wide text-[var(--muted)] uppercase">
                {item.kind} · {item.decision}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.reasoning}
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)]">
                {item.evidence.map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
              {onDecide && item.decision === "PENDING" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
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
                    className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setAdjusting(item.id);
                      setAdjustNote("");
                    }}
                    className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs"
                  >
                    Adjust
                  </button>
                  <button
                    type="button"
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
                    className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {adjusting === item.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={adjustNote}
                    onChange={(event) => setAdjustNote(event.target.value)}
                    className="w-full rounded-md border border-[var(--rule)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="Adjustment note"
                  />
                  <button
                    type="button"
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
                    className="rounded-md bg-[var(--foreground)] px-3 py-1 text-xs text-[var(--background)]"
                  >
                    Save adjustment
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
