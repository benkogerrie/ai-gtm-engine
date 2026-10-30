"use client";

import { useActionState } from "react";
import Link from "next/link";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { EvidenceLabelBadge, EvidenceLegend } from "@/components/evidence-label";
import type { DashboardCard, DashboardSnapshot } from "@/lib/pipeline/board";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@/lib/pipeline/stages";
import { moveDashboardCardAction, type DashboardActionState } from "./actions";

function StageColumn({
  stage,
  cards,
  icpId,
}: {
  stage: PipelineStage;
  cards: DashboardCard[];
  icpId?: string;
}) {
  return (
    <section className="min-w-56 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs tracking-wide text-[var(--muted)] uppercase">
          {PIPELINE_STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs tabular-nums text-[var(--muted)]">{cards.length}</span>
      </div>
      <ul className="mt-3 grid gap-2">
        {cards.map((card) => (
          <li
            key={`${stage}-${card.companyId}`}
            className="rounded-md border border-[var(--rule)] bg-[var(--background)] p-3"
          >
            <p className="text-sm font-medium">{card.name}</p>
            {card.domain ? (
              <p className="text-xs text-[var(--muted)]">{card.domain}</p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--muted)]">
              Fit {card.fitScore ?? "—"}{" "}
              <EvidenceLabelBadge label="INFERRED" />
            </p>
            {card.stageSource === "manual" ? (
              <p className="mt-1 text-[10px] tracking-wide text-[var(--muted)] uppercase">
                manual · {card.stageActor} · {card.stageAt}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <DraftOutreachButton companyId={card.companyId} />
              {card.outreachId ? (
                <Link
                  href={`/outreach/${card.outreachId}`}
                  className="inline-flex rounded-md border border-[var(--rule)] px-3 py-2 text-xs"
                >
                  Open draft
                </Link>
              ) : null}
            </div>
            <MoveForm card={card} icpId={icpId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoveForm({ card, icpId }: { card: DashboardCard; icpId?: string }) {
  const [state, action, pending] = useActionState(
    moveDashboardCardAction,
    {} as DashboardActionState,
  );
  return (
    <form action={action} className="mt-2 grid gap-2">
      <input type="hidden" name="companyId" value={card.companyId} />
      {icpId ? <input type="hidden" name="icpId" value={icpId} /> : null}
      <label className="block text-[11px] text-[var(--muted)]">
        Move
        <select
          name="stage"
          defaultValue={card.stage}
          className="mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-2 py-1 text-xs"
        >
          {card.allowedMoves.map((stage) => (
            <option key={stage} value={stage}>
              {PIPELINE_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--rule)] px-2 py-1 text-xs disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save move"}
      </button>
      {state.error ? (
        <p className="text-xs text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function DashboardBoard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [
      stage,
      snapshot.cards.filter((card) => card.stage === stage),
    ]),
  ) as Record<PipelineStage, DashboardCard[]>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <p>
          Email drafts:{" "}
          <span className="text-[var(--foreground)]">{snapshot.channelCounts.email}</span>
        </p>
        <p>
          LinkedIn drafts:{" "}
          <span className="text-[var(--foreground)]">
            {snapshot.channelCounts.linkedin}
          </span>
        </p>
      </div>
      <EvidenceLegend />
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              cards={byStage[stage]}
              icpId={snapshot.icp?.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
