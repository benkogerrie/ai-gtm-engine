import { z } from "zod";
import { getDb } from "@/db/client";
import {
  handleRouteError,
  jsonError,
  requireAuth,
  toJsonSafe,
} from "@/lib/http";
import {
  draftOutreachForCompany,
  listOutreachViews,
  outreachCtaSchema,
  outreachToneSchema,
  seedDemoCompany,
} from "@/lib/outreach";

const draftBodySchema = z.object({
  companyId: z.uuid(),
  tone: outreachToneSchema.default("professional"),
  cta: outreachCtaSchema.default("book a call"),
});

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const db = await getDb();
  const rows = await listOutreachViews(db, auth.auth.orgId);
  return Response.json(toJsonSafe(rows));
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (
    body &&
    typeof body === "object" &&
    "seedDemo" in body &&
    (body as { seedDemo?: unknown }).seedDemo === true
  ) {
    try {
      const db = await getDb();
      const result = await seedDemoCompany(db, auth.auth);
      return Response.json(toJsonSafe(result), { status: 201 });
    } catch (error) {
      return handleRouteError(error);
    }
  }

  const parsed = draftBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", z.flattenError(parsed.error));
  }

  try {
    const db = await getDb();
    const drafted = await draftOutreachForCompany(db, parsed.data, auth.auth);
    return Response.json(toJsonSafe(drafted), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
