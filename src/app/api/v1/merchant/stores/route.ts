import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { NegoZaarRepository } from "@/database/repository";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "stores:read");

    const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);

    return NextResponse.json({ stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
