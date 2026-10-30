"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-[var(--rule)] bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-60"
    >
      {pending ? "Searching…" : "Find prospects"}
    </button>
  );
}
