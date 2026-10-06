import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { ShopifySyncService } from "@/modules/ecommerce/shopify/shopify-sync-service";

export async function POST(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);

    const authContext = await AuthService.resolveAuthContext(authHeader);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    let storeId = body.storeId;
    let store;

    if (storeId) {
      store = await TenantContextManager.validateStoreAccess(authContext, storeId);
    } else {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      store = stores.find((s) => s.platform === "SHOPIFY") || stores[0];
    }

    if (!store) {
      return NextResponse.json(
        { success: false, error: "No connected Shopify store found for this merchant organization" },
        { status: 404 }
      );
    }

    const creds = await NegoZaarRepository.getStoreCredentials(store.id);
    if (!creds) {
      return NextResponse.json(
        {
          success: false,
          error: `Store "${store.storeName}" is not currently connected to Shopify or credentials have expired. Please connect via Shopify OAuth first.`,
          code: "STORE_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    const syncResult = await ShopifySyncService.syncProducts(store.id);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${syncResult.totalSynced} products from Shopify`,
      storeId: store.id,
      storeName: store.storeName,
      syncResult,
    });
  } catch (error) {
    console.error("[Shopify Catalog Sync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Catalog synchronization failed",
      },
      { status: 500 }
    );
  }
}
