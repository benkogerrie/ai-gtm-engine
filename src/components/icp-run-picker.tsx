import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClass =
  "mt-1 flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function IcpRunPicker({
  snapshotIcpId,
  snapshotRunId,
  icps,
  runs,
}: {
  snapshotIcpId: string | undefined;
  snapshotRunId: string | undefined;
  icps: Array<{ id: string; name: string; status: string }>;
  runs: Array<{ id: string; status: string; updatedAt: string; prospectCount: number }>;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <Label>
        <span className="text-muted-foreground">ICP</span>
        <select name="icp" defaultValue={snapshotIcpId ?? ""} className={selectClass}>
          {icps.length === 0 ? (
            <option value="">No ICPs yet</option>
          ) : (
            icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name} · {icp.status}
              </option>
            ))
          )}
        </select>
      </Label>
      <Label>
        <span className="text-muted-foreground">Discovery run</span>
        <select name="run" defaultValue={snapshotRunId ?? ""} className={selectClass}>
          {runs.length === 0 ? (
            <option value="">No completed runs</option>
          ) : (
            runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.slice(0, 8)} · {run.status} · {run.prospectCount} orgs ·{" "}
                {new Date(run.updatedAt).toLocaleString()}
              </option>
            ))
          )}
        </select>
      </Label>
      <Button type="submit" variant="outline">
        Show
      </Button>
    </form>
  );
}
