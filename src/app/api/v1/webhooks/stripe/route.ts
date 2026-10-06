import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/modules/billing/billing-service";
import { IdempotencyManager } from "@/modules/reliability/idempotency";
import { Logger } from "@/modules/monitoring/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature");

    const event = JSON.parse(rawBody || "{}");
    const eventId = event.id;

    Logger.info(`[Stripe Webhook] Received event ${event.type}`, { eventId, type: event.type });

    // Check webhook idempotency
    if (eventId) {
      const alreadyProcessed = await IdempotencyManager.isProcessed(eventId);
      if (alreadyProcessed) {
        Logger.info(`[Stripe Webhook] Deduplicated already processed event ${eventId}`);
        return NextResponse.json({ received: true, deduplicated: true });
      }
    }

    const result = await BillingService.handleStripeWebhook(event);

    if (eventId) {
      await IdempotencyManager.markProcessed(eventId);
    }

    return NextResponse.json({
      received: true,
      handled: result.handled,
      action: result.action,
    });
  } catch (error) {
    Logger.error("[Stripe Webhook] Processing error", error);
    return NextResponse.json(
      { error: "Stripe webhook processing failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
