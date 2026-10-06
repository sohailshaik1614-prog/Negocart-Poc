import { NextRequest } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { RateLimiter } from "@/modules/security/rate-limiter";
import { DomainError } from "@/core/errors/domain-errors";
import { jsonWithCors, corsOptionsResponse } from "@/modules/security/cors";

const startSessionSchema = z.object({
  publicStoreKey: z.string().min(1, "Public store key required"),
  productId: z.string().min(1, "Product ID required"),
  deviceFingerprint: z.string().default("anonymous_device"),
  customerEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = RateLimiter.check(`session_init_${ip}`, 15, 60);

    if (!rateCheck.allowed) {
      return jsonWithCors(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateCheck.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = startSessionSchema.parse(body);

    const result = await NegotiationSessionManager.startSession(parsed);

    return jsonWithCors(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonWithCors({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return jsonWithCors({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[POST /api/v1/widget/session] Error:", error);
    return jsonWithCors({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsOptionsResponse();
}
