import { NextRequest } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { DomainError } from "@/core/errors/domain-errors";
import { jsonWithCors, corsOptionsResponse } from "@/modules/security/cors";

const endSessionSchema = z.object({
  sessionToken: z.string().min(1, "Session token required"),
  reason: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = endSessionSchema.parse(body);

    const result = await NegotiationSessionManager.endNegotiation(
      "",
      parsed.reason || "Customer left negotiation",
      parsed.sessionToken
    );

    const publicView = await NegotiationSessionManager.buildPublicView(result.session.id);

    return jsonWithCors({
      success: true,
      message: "Negotiation ended",
      view: publicView,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonWithCors({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return jsonWithCors({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[POST /api/v1/widget/end] Error:", error);
    return jsonWithCors({ error: "Failed to end negotiation" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsOptionsResponse();
}
