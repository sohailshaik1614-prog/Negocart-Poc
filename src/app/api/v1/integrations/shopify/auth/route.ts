import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { ShopifyOAuth } from "@/modules/ecommerce/shopify/shopify-oauth";
import { env } from "@/config/env";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const format = searchParams.get("format");

    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Missing required 'shop' parameter (e.g. ?shop=my-store.myshopify.com)" },
        { status: 400 }
      );
    }

    // Resolve authenticated merchant context
    let merchantId = "a0000000-0000-0000-0000-000000000001";
    try {
      const authHeader =
        req.headers.get("authorization") ||
        req.cookies.get("negozaar_session")?.value ||
        (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
      if (authHeader) {
        const authContext = await AuthService.resolveAuthContext(authHeader);
        merchantId = authContext.merchantId;
      }
    } catch {
      // Fallback to default merchant in dev/test
    }

    const sanitizedShop = ShopifyOAuth.sanitizeShopDomain(shop);
    const state = ShopifyOAuth.generateState(merchantId);

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/v1/integrations/shopify/callback`;

    const authorizationUrl = ShopifyOAuth.buildAuthorizationUrl(sanitizedShop, state, redirectUri);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        shop: sanitizedShop,
        authorizationUrl,
        state,
      });
    }

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error("[Shopify Auth] Initialization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate Shopify authorization",
      },
      { status: 400 }
    );
  }
}
