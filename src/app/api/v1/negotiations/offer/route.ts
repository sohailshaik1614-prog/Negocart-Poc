import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { RateLimiter } from "@/modules/security/rate-limiter";
import { DomainError } from "@/core/errors/domain-errors";

const submitOfferSchema = z.object({
  sessionId: z.string().uuid().optional(),
  sessionToken: z.string().optional(),
  proposedAmount: z.number().positive("Offer amount must be a positive number"),
  message: z.string().max(500).optional(),
}).refine((data) => data.sessionId || data.sessionToken, {
  message: "Either sessionId or sessionToken must be provided",
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = RateLimiter.check(`nego_offer_${ip}`, 30, 60);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait a moment before sending another offer." },
        { status: 429, headers: { "Retry-After": String(rateCheck.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = submitOfferSchema.parse(body);

    const result = await NegotiationSessionManager.submitCustomerOffer(parsed);

    return NextResponse.json({
      success: true,
      message: result.dealClosed ? "Deal agreed and accepted!" : "Counteroffer generated",
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
    const message = error instanceof Error ? error.message : "Failed to process offer";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
