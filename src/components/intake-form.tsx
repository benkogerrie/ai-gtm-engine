"use client";

import { useActionState } from "react";
import { submitIntakeAction, type IntakeState } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

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
  return (
    <Label>
      <span>{label}</span>
      {textarea ? (
        <Textarea name={name} required={required} rows={4} className="mt-1" />
      ) : (
        <Input name={name} required={required} className="mt-1" />
      )}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </Label>
  );
}

export function IntakeForm({ mockMode }: { mockMode: boolean }) {
  const [state, action, pending] = useActionState(submitIntakeAction, initial);

  return (
    <form action={action} className="mt-8 space-y-5">
      {mockMode ? (
        <p className="rounded-md border border-accent bg-accent px-3 py-2 text-sm text-accent-foreground">
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
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Inferring ICP…
          </>
        ) : (
          "Submit product and infer ICP"
        )}
      </Button>
    </form>
  );
}
