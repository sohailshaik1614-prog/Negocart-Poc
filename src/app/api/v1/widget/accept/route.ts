import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { DomainError } from "@/core/errors/domain-errors";

const acceptDealSchema = z.object({
  sessionToken: z.string().min(1, "Session token required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptDealSchema.parse(body);

    const result = await NegotiationSessionManager.claimDeal(parsed.sessionToken);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[POST /api/v1/widget/accept] Error:", error);
    return NextResponse.json({ error: "Failed to finalize negotiated deal" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Store-Key",
    },
  });
}
