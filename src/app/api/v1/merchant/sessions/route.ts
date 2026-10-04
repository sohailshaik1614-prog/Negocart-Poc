import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.cookies.get("negozaar_session")?.value;
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "sessions:read");

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Validate session access: Ensures session belongs to authenticated merchant
      const session = await TenantContextManager.validateSessionAccess(authContext, sessionId);
      const messages = await NegoZaarRepository.getSessionMessages(sessionId);
      const offers = await NegoZaarRepository.getSessionOffers(sessionId);

      return NextResponse.json({
        success: true,
        data: {
          session,
          messages,
          offers,
        },
      });
    }

    if (storeId) {
      await TenantContextManager.validateStoreAccess(authContext, storeId);
      const sessions = await NegoZaarRepository.getRecentSessions(storeId, 50);
      return NextResponse.json({
        success: true,
        data: { sessions, total: sessions.length },
      });
    }

    // Default: fetch all sessions belonging to this merchant organization
    const sessions = await NegoZaarRepository.getSessionsForMerchant(authContext.merchantId, 50);
    return NextResponse.json({
      success: true,
      data: { sessions, total: sessions.length },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}
