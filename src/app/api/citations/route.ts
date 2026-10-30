import { createCitationApiSchema } from "@/domain";
import { getDb } from "@/db/client";
import { createCitation } from "@/db/repository";
import {
  handleRouteError,
  parseJson,
  requireAuth,
  toJsonSafe,
} from "@/lib/http";

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseJson(request, createCitationApiSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const db = await getDb();
    const created = await createCitation(
      db,
      { ...parsed.data, orgId: auth.auth.orgId },
      auth.auth.actor,
    );
    return Response.json(toJsonSafe(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
