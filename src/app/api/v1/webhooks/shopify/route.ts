import { NextRequest, NextResponse } from "next/server";
import { HmacVerifier } from "@/modules/security/hmac";
import { env } from "@/config/env";
import { NegoZaarRepository } from "@/database/repository";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");

    // In production, verify HMAC with SHOPIFY_API_SECRET
    if (env.SHOPIFY_API_SECRET && hmacHeader) {
      const isValid = HmacVerifier.verifyShopifyHmac(rawBody, hmacHeader, env.SHOPIFY_API_SECRET);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook HMAC signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || "{}");

    // Handle order creation to attribute negotiation discounts
    if (topic === "orders/create") {
      const discountCodes = payload.discount_codes || [];
      for (const dc of discountCodes) {
        // Check if code matches NegoZaar prefix or transaction
        if (dc.code?.startsWith("NEGO-")) {
          await NegoZaarRepository.recordAnalyticsEvent({
            id: crypto.randomUUID(),
            storeId: shopDomain || "unknown_store",
            eventType: "ORDER_CONVERTED",
            properties: {
              orderId: payload.id,
              orderNumber: payload.order_number,
              discountCode: dc.code,
              amount: dc.amount,
              totalPrice: payload.total_price,
            },
            occurredAt: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Shopify Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
