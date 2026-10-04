import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NegotiationSessionManager } from "@/modules/negotiation/session-manager";
import { RateLimiter } from "@/modules/security/rate-limiter";
import { DomainError } from "@/core/errors/domain-errors";

const startNegotiationSchema = z.object({
  publicStoreKey: z.string().optional(),
  storeId: z.string().uuid().optional(),
  productId: z.string().min(1, "Product ID is required"),
  cartReference: z.string().optional(),
  deviceFingerprint: z.string().default("anonymous_device"),
  customerEmail: z.string().email().optional(),
}).refine((data) => data.publicStoreKey || data.storeId, {
  message: "Either publicStoreKey or storeId must be provided",
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = RateLimiter.check(`nego_start_${ip}`, 20, 60);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait before starting another negotiation." },
        { status: 429, headers: { "Retry-After": String(rateCheck.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = startNegotiationSchema.parse(body);

    const result = await NegotiationSessionManager.startSession(parsed);

    return NextResponse.json(
      {
        success: true,
        message: "Negotiation session started",
        data: result,
      },
      { status: 201 }
    );
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
    const message = error instanceof Error ? error.message : "Failed to start negotiation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
