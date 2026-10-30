import { uuidSchema } from "@/domain";
import { getDb } from "@/db/client";
import { getCompanyWithEvidence } from "@/db/repository";
import { jsonError, requireAuth, toJsonSafe } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return jsonError(400, "Invalid company id");
  }

  const db = await getDb();
  const result = await getCompanyWithEvidence(db, parsed.data, auth.auth.orgId);
  if (!result) {
    return jsonError(404, "Company not found");
  }

  return Response.json(toJsonSafe(result));
}
