import { z } from "zod";
import { uuidSchema } from "@/domain";
import { getDb } from "@/db/client";
import {
  handleRouteError,
  jsonError,
  requireAuth,
  toJsonSafe,
} from "@/lib/http";
import {
  approveOutreachDraft,
  editOutreachDraft,
  loadOutreachView,
  outreachCtaSchema,
  outreachToneSchema,
  regenerateOutreach,
  rejectOutreachDraft,
  sendOutreachDryRun,
} from "@/lib/outreach";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    subject: z.string().min(1),
    body: z.string().min(1),
    linkedinMessage: z.string().min(1),
  }),
  z.object({
    action: z.literal("regenerate"),
    tone: outreachToneSchema,
    cta: outreachCtaSchema,
  }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), note: z.string().optional() }),
  z.object({ action: z.literal("dry-run") }),
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "Invalid outreach id");
  }

  try {
    const db = await getDb();
    const view = await loadOutreachView(db, id, auth.auth.orgId);
    return Response.json(toJsonSafe(view));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "Invalid outreach id");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", z.flattenError(parsed.error));
  }

  try {
    const db = await getDb();
    const ctx = auth.auth;
    switch (parsed.data.action) {
      case "edit":
        return Response.json(
          toJsonSafe(
            await editOutreachDraft(
              db,
              {
                outreachId: id,
                subject: parsed.data.subject,
                body: parsed.data.body,
                linkedinMessage: parsed.data.linkedinMessage,
              },
              ctx,
            ),
          ),
        );
      case "regenerate":
        return Response.json(
          toJsonSafe(
            await regenerateOutreach(
              db,
              {
                outreachId: id,
                tone: parsed.data.tone,
                cta: parsed.data.cta,
              },
              ctx,
            ),
          ),
        );
      case "approve":
        return Response.json(
          toJsonSafe(await approveOutreachDraft(db, id, ctx)),
        );
      case "reject":
        return Response.json(
          toJsonSafe(await rejectOutreachDraft(db, id, ctx, parsed.data.note)),
        );
      case "dry-run":
        return Response.json(toJsonSafe(await sendOutreachDryRun(db, id, ctx)));
      default:
        return jsonError(400, "Unknown action");
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
