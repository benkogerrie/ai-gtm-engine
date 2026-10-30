import { handleRouteError, jsonError, parseJson, requireAuth } from "@/lib/http";
import { isLlmError } from "@/lib/llm";
import {
  isSiteIntakeError,
  readSite,
  siteReadRequestSchema,
} from "@/lib/site-intake";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseJson(request, siteReadRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const result = await readSite(parsed.data.url);
    return Response.json({
      mode: result.mode,
      model: result.model,
      websiteUrl: result.websiteUrl,
      pages: result.pages,
      fields: result.fields,
      suggested: result.suggested,
    });
  } catch (error) {
    if (isSiteIntakeError(error)) {
      const status =
        error.code === "TIMEOUT" || error.code === "FETCH_FAILED"
          ? 502
          : error.code === "INFERENCE_FAILED"
            ? 502
            : 400;
      return jsonError(status, error.message, { code: error.code });
    }
    if (isLlmError(error)) {
      return jsonError(502, error.message);
    }
    return handleRouteError(error);
  }
}
