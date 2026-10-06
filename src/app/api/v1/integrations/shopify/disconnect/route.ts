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
        { success: false, error: "No connected store found to disconnect" },
        { status: 404 }
      );
    }

    await ShopifySyncService.disconnectStore(store.id);

    return NextResponse.json({
      success: true,
      message: `Store ${store.storeName} (${store.platformStoreId}) successfully disconnected`,
      storeId: store.id,
    });
  } catch (error) {
    console.error("[Shopify Disconnect] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect store",
      },
      { status: 500 }
    );
  }
}
