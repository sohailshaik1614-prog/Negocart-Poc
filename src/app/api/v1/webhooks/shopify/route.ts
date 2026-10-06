import { NextRequest, NextResponse } from "next/server";
import { HmacVerifier } from "@/modules/security/hmac";
import { env } from "@/config/env";
import { ShopifyWebhookHandler } from "@/modules/ecommerce/shopify/shopify-webhook-handler";
import { IdempotencyManager } from "@/modules/reliability/idempotency";
import { Logger } from "@/modules/monitoring/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic") || "";
    const shopDomain = req.headers.get("x-shopify-shop-domain") || "";
    const webhookId = req.headers.get("x-shopify-webhook-id");

    Logger.info(`[Shopify Webhook] Received ${topic} for ${shopDomain}`, {
      topic,
      shopDomain,
      webhookId: webhookId || undefined,
    });

    // 1. Verify HMAC signature in production or when secret is configured
    if (env.SHOPIFY_API_SECRET && hmacHeader && !env.SHOPIFY_API_SECRET.includes("placeholder")) {
      const isValid = HmacVerifier.verifyShopifyHmac(rawBody, hmacHeader, env.SHOPIFY_API_SECRET);
      if (!isValid) {
        Logger.warn("[Shopify Webhook] Unauthorized HMAC signature failure", { shopDomain, topic });
        return NextResponse.json({ error: "Invalid webhook HMAC signature" }, { status: 401 });
      }
    }

    // 2. Check Webhook Idempotency (prevent duplicate processing of re-delivered webhooks)
    if (webhookId) {
      const alreadyProcessed = await IdempotencyManager.isProcessed(webhookId);
      if (alreadyProcessed) {
        Logger.info(`[Shopify Webhook] Deduplicated already processed webhook ${webhookId}`, {
          webhookId,
          topic,
        });
        return NextResponse.json({ received: true, deduplicated: true });
      }
    }

    const payload = JSON.parse(rawBody || "{}");

    // 3. Delegate processing to specialized Shopify webhook handler
    const result = await ShopifyWebhookHandler.handleWebhook(topic, shopDomain, payload);

    // 4. Mark webhook as processed
    if (webhookId) {
      await IdempotencyManager.markProcessed(webhookId);
    }

    return NextResponse.json({
      received: true,
      topic,
      handled: result.handled,
      details: result.details,
    });
  } catch (error) {
    Logger.error("[Shopify Webhook] Processing error", error);
    return NextResponse.json(
      { error: "Webhook processing failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
