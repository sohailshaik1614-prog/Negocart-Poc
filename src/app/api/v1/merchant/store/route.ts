import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

const updateStoreSchema = z.object({
  storeId: z.string().uuid().optional(),
  storeName: z.string().min(2).optional(),
  platformStoreId: z.string().min(2).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DISCONNECTED"]).optional(),
  settings: z.object({
    brandColor: z.string().optional(),
    widgetTheme: z.enum(["light", "dark", "auto"]).optional(),
    position: z.enum(["bottom-right", "bottom-left", "inline"]).optional(),
    buttonText: z.string().optional(),
    requireEmailToClaim: z.boolean().optional(),
    bannerTitle: z.string().optional(),
  }).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    let store;
    if (storeId) {
      store = await TenantContextManager.validateStoreAccess(authContext, storeId);
    } else {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      store = stores[0];
    }

    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: store,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "stores:write");

    const body = await req.json();
    const parsed = updateStoreSchema.parse(body);

    let targetStoreId = parsed.storeId;
    if (!targetStoreId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length === 0) {
        return NextResponse.json({ success: false, error: "No stores found for merchant" }, { status: 404 });
      }
      targetStoreId = stores[0].id;
    }

    // Tenant Isolation Check
    await TenantContextManager.validateStoreAccess(authContext, targetStoreId);

    const updated = await NegoZaarRepository.updateStore(targetStoreId, {
      storeName: parsed.storeName,
      platformStoreId: parsed.platformStoreId,
      currency: parsed.currency,
      status: parsed.status,
      settings: parsed.settings,
    });

    return NextResponse.json({
      success: true,
      message: "Store profile updated successfully",
      data: updated,
    });
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
    const message = error instanceof Error ? error.message : "Failed to update store";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
