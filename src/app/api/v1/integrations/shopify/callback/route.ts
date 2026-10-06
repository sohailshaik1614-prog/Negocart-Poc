import { NextRequest, NextResponse } from "next/server";
import { ShopifyOAuth } from "@/modules/ecommerce/shopify/shopify-oauth";
import { ShopifySyncService } from "@/modules/ecommerce/shopify/shopify-sync-service";
import { env } from "@/config/env";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const format = searchParams.get("format");

    if (!shop || !code || !state) {
      return NextResponse.json(
        { success: false, error: "Missing required Shopify OAuth callback parameters (shop, code, state)" },
        { status: 400 }
      );
    }

    // Verify HMAC query parameters from Shopify (skip in local dev without live secrets)
    const queryObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const isLiveSecretConfigured =
      env.SHOPIFY_API_SECRET &&
      !env.SHOPIFY_API_SECRET.includes("placeholder") &&
      !env.SHOPIFY_API_SECRET.includes("dev_");

    if (isLiveSecretConfigured) {
      const isValidHmac = ShopifyOAuth.verifyCallbackHmac(queryObj);
      if (!isValidHmac) {
        return NextResponse.json(
          { success: false, error: "Invalid Shopify HMAC callback signature" },
          { status: 401 }
        );
      }
    }

    // Verify state nonce and extract merchantId
    const statePayload = ShopifyOAuth.verifyState(state);
    const merchantId = statePayload.merchantId;

    // Exchange temporary authorization code for permanent token
    const tokenResult = await ShopifyOAuth.exchangeCodeForToken(shop, code);
    const scopes = tokenResult.scope ? tokenResult.scope.split(",") : [];

    // Connect store, save encrypted token in vault, register webhooks, and sync products
    const connectionResult = await ShopifySyncService.connectStore(
      merchantId,
      shop,
      tokenResult.accessToken,
      scopes
    );

    if (format === "json") {
      return NextResponse.json({
        success: true,
        message: "Shopify store successfully connected and synchronized",
        store: connectionResult.store,
        syncStats: connectionResult.syncStats,
        webhooksRegistered: connectionResult.webhooksRegistered,
      });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const redirectDestination = `${protocol}://${host}/integrations?connected=true&shop=${encodeURIComponent(
      shop
    )}&synced=${connectionResult.syncStats.totalSynced}`;

    return NextResponse.redirect(redirectDestination);
  } catch (error) {
    console.error("[Shopify OAuth Callback] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shopify authentication callback failed",
      },
      { status: 400 }
    );
  }
}
