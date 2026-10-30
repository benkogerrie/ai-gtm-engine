import { createCitationInputSchema } from "@/domain";
import { getDb } from "@/db/client";
import { createCitation } from "@/db/repository";
import {
  actorFromHeaders,
  handleRouteError,
  parseJson,
  toJsonSafe,
} from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJson(request, createCitationInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const db = await getDb();
    const created = await createCitation(
      db,
      parsed.data,
      actorFromHeaders(request),
    );
    return Response.json(toJsonSafe(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
