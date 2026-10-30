"use client";

import { useActionState } from "react";
import Link from "next/link";
import { DraftOutreachButton } from "@/components/draft-outreach-button";
import { ViewInGraphLink } from "@/components/view-in-graph-link";
import { EvidenceLabelBadge, EvidenceRelevanceBadge } from "@/components/evidence-label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
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
  runId,
}: {
  stage: PipelineStage;
  cards: DashboardCard[];
  icpId?: string;
  runId?: string;
}) {
  return (
    <section className="w-56 shrink-0 border-t pt-3">
      <div className="mb-3 flex justify-between text-sm font-medium">
        <h3>{PIPELINE_STAGE_LABELS[stage]}</h3>
        <span className="text-muted-foreground">{cards.length}</span>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <div
            key={`${stage}-${card.companyId}`}
            className="group border-l-2 border-l-transparent pb-3 pl-3"
          >
            <p className="text-sm font-medium">{card.name}</p>
            {card.domain ? (
              <p className="text-xs text-muted-foreground">{card.domain}</p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    card.stageSource === "derived"
                      ? "bg-foreground"
                      : "border border-foreground bg-background",
                  )}
                />
                <span className="truncate">
                  {card.stageSource === "derived"
                    ? "Moved by system"
                    : `Manual${card.stageActor ? ` · ${card.stageActor}` : ""}`}
                </span>
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Fit {card.fitScore ?? "—"}{" "}
              <EvidenceLabelBadge label="INFERRED" />
              {card.evidenceRelevance ? (
                <EvidenceRelevanceBadge relevance={card.evidenceRelevance} />
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DraftOutreachButton companyId={card.companyId} />
              {card.outreachId ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/outreach/${card.outreachId}`}>Open draft</Link>
                </Button>
              ) : null}
              <ViewInGraphLink
                icpId={icpId}
                runId={runId}
                prospectId={card.companyId}
              />
            </div>
            <MoveForm card={card} icpId={icpId} runId={runId} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MoveForm({
  card,
  icpId,
  runId,
}: {
  card: DashboardCard;
  icpId?: string;
  runId?: string;
}) {
  const [state, action, pending] = useActionState(
    moveDashboardCardAction,
    {} as DashboardActionState,
  );
  return (
    <form action={action} className="mt-2 grid gap-2">
      <input type="hidden" name="companyId" value={card.companyId} />
      {icpId ? <input type="hidden" name="icpId" value={icpId} /> : null}
      {runId ? <input type="hidden" name="runId" value={runId} /> : null}
      <label className="block text-[11px] text-muted-foreground">
        Move
        <select
          name="stage"
          defaultValue={card.stage}
          className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {card.allowedMoves.map((stage) => (
            <option key={stage} value={stage}>
              {PIPELINE_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          "Save move"
        )}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive" role="alert">
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <p>
          Email drafts:{" "}
          <span className="text-foreground">{snapshot.channelCounts.email}</span>
        </p>
        <p>
          LinkedIn drafts:{" "}
          <span className="text-foreground">
            {snapshot.channelCounts.linkedin}
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-6">
          {PIPELINE_STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              cards={byStage[stage]}
              icpId={snapshot.icp?.id}
              runId={snapshot.run?.id}
            />
          ))}
        </div>
      </div>
      <p className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground" />
          Moved by system
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-foreground" />
          Manual / human-asserted
        </span>
      </p>
    </div>
  );
}
