import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/login-form";
import { safeLoginRedirect } from "@/lib/login-redirect";
import { isAuthConfigured } from "@/lib/session";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const next = safeLoginRedirect(params.next);

  return (
    <AppShell eyebrow="B003 · Sign in">
      <h1 className="font-serif text-4xl tracking-tight">Seed to Saga</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Sign in. Enter the server APP_API_TOKEN once. Org and actor are derived
        on the server — never sent from the browser.
      </p>
      <LoginForm next={next} configured={isAuthConfigured()} />
    </AppShell>
  );
}
