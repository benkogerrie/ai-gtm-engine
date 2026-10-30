import { startDiscoveryAction } from "./actions";
import { SubmitButton } from "./submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE = {
  productSummary:
    "ShiftPilot — AI shift scheduling for hospitals and clinics that need nurse staffing coverage",
  industries: "General Medical and Surgical Hospitals, health systems, clinics",
  geography: "United States",
};

export function ProspectsForm({ icpId }: { icpId?: string }) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-5">
        <form action={startDiscoveryAction} className="grid gap-4">
          {icpId ? <input type="hidden" name="icpId" value={icpId} /> : null}
          <Label className="grid gap-1">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              Product summary
            </span>
            <Textarea
              name="productSummary"
              required
              rows={3}
              defaultValue={SAMPLE.productSummary}
            />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="grid gap-1">
              <span className="text-xs tracking-wide text-muted-foreground uppercase">
                Industries
              </span>
              <Input
                name="industries"
                required
                defaultValue={SAMPLE.industries}
              />
            </Label>
            <Label className="grid gap-1">
              <span className="text-xs tracking-wide text-muted-foreground uppercase">
                Geography
              </span>
              <Input name="geography" defaultValue={SAMPLE.geography} />
            </Label>
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
