import { uuidSchema } from "@/domain";
import { getDb } from "@/db/client";
import { getCompanyWithEvidence } from "@/db/repository";
import { jsonError, toJsonSafe } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return jsonError(400, "Invalid company id");
  }

  const db = await getDb();
  const result = await getCompanyWithEvidence(db, parsed.data);
  if (!result) {
    return jsonError(404, "Company not found");
  }

  return Response.json(toJsonSafe(result));
}
