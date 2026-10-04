import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "sessions:read");

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const sessionId = searchParams.get("sessionId");

    if (!storeId) {
      return NextResponse.json({ error: "Query parameter 'storeId' required" }, { status: 400 });
    }

    await TenantContextManager.validateStoreAccess(authContext, storeId);

    if (sessionId) {
      const session = await NegoZaarRepository.getSessionById(sessionId);
      if (!session || session.storeId !== storeId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const messages = await NegoZaarRepository.getSessionMessages(sessionId);
      return NextResponse.json({ session, messages });
    }

    const sessions = await NegoZaarRepository.getRecentSessions(storeId, 50);
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
