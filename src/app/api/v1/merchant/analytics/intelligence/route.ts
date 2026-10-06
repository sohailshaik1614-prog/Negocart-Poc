import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { AnalyticsService } from "@/modules/analytics/analytics-service";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "analytics:read");

    const { searchParams } = new URL(req.url);
    let storeId = searchParams.get("storeId");

    if (!storeId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length === 0) {
        return NextResponse.json({
          success: true,
          intelligence: {
            behaviorSignals: {
              averageOfferAggressiveness: 0,
              averageConcessionStep: 0,
              customerPatienceRounds: 0,
              repeatShopperRate: 0,
              priceSensitivityScore: "MODERATE",
            },
            productRecommendations: [],
            strategyInsights: [],
            generatedAt: new Date().toISOString(),
          },
        });
      }
      storeId = stores[0].id;
    }

    await TenantContextManager.validateStoreAccess(authContext, storeId);

    const analytics = await AnalyticsService.getStoreAnalytics({
      storeId,
      timeframeDays: 30,
    });

    return NextResponse.json({
      success: true,
      intelligence: analytics.intelligence,
      revenueRecovery: analytics.revenueRecovery,
      conversionImpact: analytics.conversionImpact,
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
