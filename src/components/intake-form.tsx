"use client";

import { useActionState } from "react";
import { submitIntakeAction, type IntakeState } from "@/app/actions/intake";

const initial: IntakeState = {};

function Field({
  name,
  label,
  textarea = false,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  textarea?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const cls =
    "mt-1 w-full rounded-md border border-[var(--rule)] bg-[var(--card)] px-3 py-2 text-sm";
  return (
    <label className="block text-sm">
      <span>{label}</span>
      {textarea ? (
        <textarea name={name} required={required} rows={4} className={cls} />
      ) : (
        <input name={name} required={required} className={cls} />
      )}
      {hint ? (
        <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function IntakeForm({ mockMode }: { mockMode: boolean }) {
  const [state, action, pending] = useActionState(submitIntakeAction, initial);

  return (
    <form action={action} className="mt-8 space-y-5">
      {mockMode ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          MOCK output — DEEPSEEK_API_KEY is not set. Inference will use the labeled
          mock client.
        </p>
      ) : null}

      <Field name="name" label="Product name" required />
      <Field name="description" label="Short description" textarea required />
      <Field
        name="freeText"
        label="Describe your product (optional free text)"
        textarea
        hint="Plain language is enough. The engine extracts features, constraints, and customers."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="features"
          label="Features"
          textarea
          hint="Comma or newline separated"
        />
        <Field name="capabilities" label="Capabilities" textarea />
        <Field
          name="technicalConstraints"
          label="Technical constraints"
          textarea
        />
        <Field name="existingCustomers" label="Existing customers" textarea />
        <Field name="referenceWins" label="Reference wins" textarea />
        <Field name="pricingModel" label="Pricing model" />
        <Field name="contractValueMin" label="Contract value min (USD)" />
        <Field name="contractValueMax" label="Contract value max (USD)" />
        <Field name="monetizationModel" label="Monetization model" />
      </div>

      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
      >
        {pending ? "Inferring ICP…" : "Submit product and infer ICP"}
      </button>
    </form>
  );
}
