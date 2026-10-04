import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { MerchantOverviewMetrics } from "@/core/types/analytics.types";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "analytics:read");

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json({ error: "Query parameter 'storeId' required" }, { status: 400 });
    }

    await TenantContextManager.validateStoreAccess(authContext, storeId);

    const sessions = await NegoZaarRepository.getRecentSessions(storeId, 100);
    const totalNegotiations = sessions.length;
    const acceptedSessions = sessions.filter((s) => s.status === "ACCEPTED");
    const acceptedOffersCount = acceptedSessions.length;
    const conversionRate = totalNegotiations > 0 ? Number(((acceptedOffersCount / totalNegotiations) * 100).toFixed(1)) : 0;

    let totalNegotiatedRevenue = 0;
    let totalDiscountAmount = 0;

    for (const s of acceptedSessions) {
      if (s.finalAgreedPrice) {
        totalNegotiatedRevenue += s.finalAgreedPrice;
        totalDiscountAmount += Math.max(0, s.originalPrice - s.finalAgreedPrice);
      }
    }

    const averageDiscountPercentage =
      totalNegotiatedRevenue > 0
        ? Number(((totalDiscountAmount / (totalNegotiatedRevenue + totalDiscountAmount)) * 100).toFixed(1))
        : 0;

    const metrics: MerchantOverviewMetrics = {
      totalNegotiations,
      acceptedOffersCount,
      conversionRate,
      averageDiscountPercentage,
      totalNegotiatedRevenue,
      totalMarginProtected: Math.round(totalNegotiatedRevenue * 0.18), // Estimated margin saved by not giving full floor
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
