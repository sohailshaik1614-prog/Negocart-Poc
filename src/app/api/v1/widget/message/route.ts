import { NextRequest } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { RateLimiter } from "@/modules/security/rate-limiter";
import { DomainError } from "@/core/errors/domain-errors";
import { jsonWithCors, corsOptionsResponse } from "@/modules/security/cors";

const messageOfferSchema = z.object({
  sessionToken: z.string().min(1, "Session token required"),
  proposedAmount: z.number().positive("Offer amount must be a positive number"),
  message: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = RateLimiter.check(`message_rate_${ip}`, 20, 60);

    if (!rateCheck.allowed) {
      return jsonWithCors(
        { error: "Negotiation rate limit exceeded. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateCheck.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = messageOfferSchema.parse(body);

    const result = await NegotiationSessionManager.submitCustomerOffer(parsed);

    return jsonWithCors(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonWithCors({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return jsonWithCors({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[POST /api/v1/widget/message] Error:", error);
    return jsonWithCors({ error: "Failed to process negotiation offer" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsOptionsResponse();
}
