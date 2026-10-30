import type { EvidenceLabel, EvidenceRelevance } from "@/lib/discovery/types";
import { Badge } from "@/components/ui/badge";

const LABEL_VARIANT: Record<
  EvidenceLabel,
  "verified" | "inferred" | "candidate"
> = {
  VERIFIED: "verified",
  INFERRED: "inferred",
  "source-candidate": "candidate",
};

const LABEL_TEXT: Record<EvidenceLabel, string> = {
  VERIFIED: "VERIFIED",
  INFERRED: "INFERRED",
  "source-candidate": "SOURCE-CANDIDATE",
};

export function EvidenceLabelBadge({
  label,
}: {
  label: EvidenceLabel;
}) {
  return <Badge variant={LABEL_VARIANT[label]}>{LABEL_TEXT[label]}</Badge>;
}

export function EvidenceRelevanceBadge({
  relevance,
}: {
  relevance: EvidenceRelevance;
}) {
  return (
    <Badge variant={relevance === "strong" ? "strong" : "peripheral"}>
      {relevance === "strong" ? "STRONG" : "peripheral"}
    </Badge>
  );
}

export function EvidenceLegend() {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <EvidenceLabelBadge label="VERIFIED" />
      cited source URL
      <EvidenceLabelBadge label="INFERRED" />
      AI judgement
      <EvidenceLabelBadge label="source-candidate" />
      search hit not yet a verified fact
      <EvidenceRelevanceBadge relevance="strong" />
      direct product evidence
      <EvidenceRelevanceBadge relevance="peripheral" />
      adjacent mention
    </p>
  );
}
