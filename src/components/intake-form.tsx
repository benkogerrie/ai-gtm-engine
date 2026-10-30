"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { submitIntakeAction, type IntakeState } from "@/app/actions/intake";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  applySiteIntake,
  ensureWebsiteLine,
  isBlankFormValue,
} from "@/lib/site-intake/map-fields";
import {
  EMPTY_INTAKE_FORM,
  type IntakeFormKey,
  type IntakeFormValues,
} from "@/lib/site-intake/schema";

const initial: IntakeState = {};

const FIELD_META: Record<
  IntakeFormKey,
  { label: string; textarea?: boolean; required?: boolean; hint?: string }
> = {
  name: { label: "Product name", required: true },
  description: { label: "Short description", textarea: true, required: true },
  freeText: {
    label: "Describe your product (optional free text)",
    textarea: true,
    hint: "Plain language is enough. The engine extracts features, constraints, and customers.",
  },
  features: {
    label: "Features",
    textarea: true,
    hint: "Comma or newline separated",
  },
  capabilities: { label: "Capabilities", textarea: true },
  technicalConstraints: { label: "Technical constraints", textarea: true },
  existingCustomers: { label: "Existing customers", textarea: true },
  referenceWins: { label: "Reference wins", textarea: true },
  pricingModel: { label: "Pricing model" },
  contractValueMin: { label: "Contract value min (USD)" },
  contractValueMax: { label: "Contract value max (USD)" },
  monetizationModel: { label: "Monetization model" },
};

const GRID_KEYS: IntakeFormKey[] = [
  "features",
  "capabilities",
  "technicalConstraints",
  "existingCustomers",
  "referenceWins",
  "pricingModel",
  "contractValueMin",
  "contractValueMax",
  "monetizationModel",
];

type SiteReadResponse = {
  mode: "live" | "mock";
  websiteUrl: string;
  pages: string[];
  suggested: IntakeFormValues;
  error?: string;
};

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function IntakeField({
  name,
  value,
  onChange,
  inferredFrom,
  needsInput,
}: {
  name: IntakeFormKey;
  value: string;
  onChange: (value: string) => void;
  inferredFrom: string | null;
  needsInput: boolean;
}) {
  const meta = FIELD_META[name];
  const highlight = cn(
    "mt-1",
    needsInput &&
      "border-needs-input-border bg-needs-input-soft focus-visible:ring-needs-input",
  );
  return (
    <Label>
      <span className="flex flex-wrap items-center gap-2">
        <span>{meta.label}</span>
        {inferredFrom ? (
          <Badge variant="inferred">
            INFERRED · suggested from {hostnameFromUrl(inferredFrom)}
          </Badge>
        ) : null}
        {needsInput ? (
          <span className="text-[11px] font-medium text-needs-input">
            Nog invullen · Needs input
          </span>
        ) : null}
      </span>
      {meta.textarea ? (
        <Textarea
          name={name}
          required={meta.required}
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={highlight}
          aria-invalid={needsInput || undefined}
        />
      ) : (
        <Input
          name={name}
          required={meta.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={highlight}
          aria-invalid={needsInput || undefined}
        />
      )}
      {meta.hint ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {meta.hint}
        </span>
      ) : null}
    </Label>
  );
}

export function IntakeForm({ mockMode }: { mockMode: boolean }) {
  const [state, action, pending] = useActionState(submitIntakeAction, initial);
  const [values, setValues] = useState<IntakeFormValues>(EMPTY_INTAKE_FORM);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readMode, setReadMode] = useState<"live" | "mock" | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [inferredKeys, setInferredKeys] = useState<IntakeFormKey[]>([]);
  const [skippedKeys, setSkippedKeys] = useState<IntakeFormKey[]>([]);
  const [suggested, setSuggested] = useState<IntakeFormValues | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [hasRead, setHasRead] = useState(false);
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  function setField(name: IntakeFormKey, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function applySuggested(
    next: IntakeFormValues,
    fromUrl: string,
    mode: "empty-only" | "replace",
  ) {
    const applied = applySiteIntake(valuesRef.current, next, mode);
    setValues(applied.values);
    setInferredKeys(applied.inferredKeys);
    setSkippedKeys(applied.skippedKeys);
    setSuggested(next);
    setSourceUrl(fromUrl);
    setHasRead(true);
  }

  async function readSite() {
    setReadError(null);
    setReading(true);
    try {
      const response = await fetch("/api/intake/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const body = (await response.json()) as SiteReadResponse;
      if (!response.ok) {
        setReadError(body.error ?? "Could not read that website.");
        return;
      }
      setReadMode(body.mode);
      setPages(body.pages);
      applySuggested(body.suggested, body.websiteUrl, "empty-only");
    } catch {
      setReadError("Could not read that website.");
    } finally {
      setReading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const free = form.elements.namedItem("freeText") as HTMLTextAreaElement | null;
    const source = sourceUrl ?? websiteUrl.trim();
    if (free && source) {
      free.value = ensureWebsiteLine(free.value, source);
    }
  }

  function fieldNeedsInput(name: IntakeFormKey): boolean {
    return hasRead && isBlankFormValue(values[name]);
  }

  return (
    <form action={action} onSubmit={onSubmit} className="mt-8 space-y-5">
      {mockMode ? (
        <p className="rounded-md border border-accent bg-accent px-3 py-2 text-sm text-accent-foreground">
          MOCK output — DEEPSEEK_API_KEY is not set. Inference will use the labeled
          mock client.
        </p>
      ) : null}

      <div className="rounded-lg border bg-card p-4">
        <Label>
          <span>Website URL</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourcompany.com"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void readSite();
                }
              }}
              aria-label="Website URL"
            />
            <Button
              type="button"
              onClick={() => void readSite()}
              disabled={reading || pending || !websiteUrl.trim()}
            >
              {reading ? (
                <>
                  <Spinner />
                  Reading your site…
                </>
              ) : (
                "Read my site"
              )}
            </Button>
          </div>
        </Label>
        {reading ? (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            Reading your site…
          </p>
        ) : null}
        {readError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {readError}
          </p>
        ) : null}
        {readMode === "mock" && !mockMode ? (
          <p className="mt-2 text-sm text-accent-foreground">
            MOCK output — DEEPSEEK_API_KEY is not set. Site fields were labeled by
            the mock client.
          </p>
        ) : null}
        {pages.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Pages read</p>
            <ul className="mt-1 space-y-1">
              {pages.map((page) => (
                <li key={page}>
                  <a
                    href={page}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    {page}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {skippedKeys.length > 0 && suggested && sourceUrl ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {skippedKeys.length} filled field
              {skippedKeys.length === 1 ? " was" : "s were"} left unchanged.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applySuggested(suggested, sourceUrl, "replace")}
            >
              Replace existing values
            </Button>
          </div>
        ) : null}
      </div>

      <IntakeField
        name="name"
        value={values.name}
        onChange={(value) => setField("name", value)}
        inferredFrom={inferredKeys.includes("name") ? sourceUrl : null}
        needsInput={fieldNeedsInput("name")}
      />
      <IntakeField
        name="description"
        value={values.description}
        onChange={(value) => setField("description", value)}
        inferredFrom={inferredKeys.includes("description") ? sourceUrl : null}
        needsInput={fieldNeedsInput("description")}
      />
      <IntakeField
        name="freeText"
        value={values.freeText}
        onChange={(value) => setField("freeText", value)}
        inferredFrom={inferredKeys.includes("freeText") ? sourceUrl : null}
        needsInput={fieldNeedsInput("freeText")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        {GRID_KEYS.map((name) => (
          <IntakeField
            key={name}
            name={name}
            value={values[name]}
            onChange={(value) => setField(name, value)}
            inferredFrom={inferredKeys.includes(name) ? sourceUrl : null}
            needsInput={fieldNeedsInput(name)}
          />
        ))}
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || reading}>
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
