import { startDiscoveryAction } from "./actions";
import { SubmitButton } from "./submit-button";

const SAMPLE = {
  productSummary:
    "B2B HRIS that automates payroll, benefits, and onboarding for mid-market companies",
  industries: "Human Resources Software, HRIS",
  geography: "United States",
};

export function ProspectsForm() {
  return (
    <form
      action={startDiscoveryAction}
      className="grid gap-4 rounded-lg border border-[var(--rule)] bg-[var(--card)] p-5"
    >
      <label className="grid gap-1 text-sm">
        <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
          Product summary
        </span>
        <textarea
          name="productSummary"
          required
          rows={3}
          defaultValue={SAMPLE.productSummary}
          className="rounded-md border border-[var(--rule)] bg-transparent px-3 py-2"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
            Industries
          </span>
          <input
            name="industries"
            required
            defaultValue={SAMPLE.industries}
            className="rounded-md border border-[var(--rule)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs tracking-wide text-[var(--muted)] uppercase">
            Geography
          </span>
          <input
            name="geography"
            defaultValue={SAMPLE.geography}
            className="rounded-md border border-[var(--rule)] bg-transparent px-3 py-2"
          />
        </label>
      </div>
      <SubmitButton />
    </form>
  );
}
