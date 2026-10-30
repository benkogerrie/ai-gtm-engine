import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IntakeForm } from "@/components/intake-form";
import { isLlmConfigured } from "@/lib/llm";
import { getPageAuth } from "@/lib/session";

export const instant = false;

async function IntakeBody() {
  await connection();
  const auth = await getPageAuth();
  if (!auth) {
    redirect("/login?next=/intake");
  }

  return (
    <AppShell eyebrow="B003 · Product intake" showLogout>
      <h1 className="font-serif text-4xl tracking-tight">Product intake</h1>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">
        Describe the product in structured fields or free text. The engine
        infers a draft ICP with field-level confidence. Inferred fields stay
        INFERRED until a human approves the profile.
      </p>
      <IntakeForm mockMode={!isLlmConfigured()} />
    </AppShell>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--muted)]">Loading…</p>}>
      <IntakeBody />
    </Suspense>
  );
}
