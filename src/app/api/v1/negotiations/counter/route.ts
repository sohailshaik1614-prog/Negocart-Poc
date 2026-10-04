import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { DomainError } from "@/core/errors/domain-errors";

const counterSchema = z.object({
  sessionId: z.string().uuid("Valid session ID required"),
  sessionToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = counterSchema.parse(body);

    const counter = await NegotiationSessionManager.generateCounteroffer(
      parsed.sessionId,
      parsed.sessionToken
    );

    return NextResponse.json({
      success: true,
      message: counter.isFinalOffer ? "Final counteroffer generated" : "Counteroffer generated",
      data: counter,
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
    const message = error instanceof Error ? error.message : "Failed to generate counteroffer";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
