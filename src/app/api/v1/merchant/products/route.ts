import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:read");

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json({ error: "Query parameter 'storeId' is required" }, { status: 400 });
    }

    await TenantContextManager.validateStoreAccess(authContext, storeId);

    const products = await NegoZaarRepository.getProductsForStore(storeId);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
