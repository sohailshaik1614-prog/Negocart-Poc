import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { DomainError } from "@/core/errors/domain-errors";

const rejectSchema = z.object({
  sessionId: z.string().uuid().optional(),
  sessionToken: z.string().optional(),
  reason: z.string().max(255).optional(),
}).refine((data) => data.sessionId || data.sessionToken, {
  message: "Either sessionId or sessionToken must be provided",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = rejectSchema.parse(body);

    const result = await NegotiationSessionManager.rejectOffer(
      parsed.sessionId || "",
      parsed.reason,
      parsed.sessionToken
    );

    return NextResponse.json({
      success: true,
      message: "Offer rejected and session closed",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to reject offer";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
