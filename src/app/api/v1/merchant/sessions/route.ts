import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "sessions:read");

    const { searchParams } = new URL(req.url);
    const storeIdParam = searchParams.get("storeId");
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Validate session access: Ensures session belongs to authenticated merchant
      const session = await TenantContextManager.validateSessionAccess(authContext, sessionId);
      const messages = await NegoZaarRepository.getSessionMessages(sessionId);
      const offers = await NegoZaarRepository.getSessionOffers(sessionId);
      const product = session.productId ? await NegoZaarRepository.getProductById(session.productId) : null;
      const rule = (session.storeId && session.productId) ? await NegoZaarRepository.getProductRule(session.storeId, session.productId) : null;
      const transaction = await NegoZaarRepository.getTransactionBySessionId(sessionId);

      return NextResponse.json({
        success: true,
        data: {
          session,
          product,
          rule,
          messages,
          offers,
          transaction,
        },
      });
    }

    let targetStoreId = storeIdParam;
    if (!targetStoreId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length > 0) {
        targetStoreId = stores[0].id;
      }
    }

    let rawSessions;
    if (targetStoreId) {
      await TenantContextManager.validateStoreAccess(authContext, targetStoreId);
      rawSessions = await NegoZaarRepository.getRecentSessions(targetStoreId, 100);
    } else {
      rawSessions = await NegoZaarRepository.getSessionsForMerchant(authContext.merchantId, 100);
    }

    // Enrich sessions with product details
    const enrichedSessions = await Promise.all(
      rawSessions.map(async (s) => {
        const prod = s.productId ? await NegoZaarRepository.getProductById(s.productId) : null;
        return {
          ...s,
          productTitle: prod?.title || "Product",
          productSku: prod?.sku,
          productImage: prod?.imageUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        sessions: enrichedSessions,
        total: enrichedSessions.length,
      },
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
