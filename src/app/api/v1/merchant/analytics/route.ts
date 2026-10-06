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
    const timeframeParam = searchParams.get("timeframe") || "30d";

    let timeframeDays = 30;
    if (timeframeParam === "7d") timeframeDays = 7;
    else if (timeframeParam === "14d") timeframeDays = 14;
    else if (timeframeParam === "90d") timeframeDays = 90;

    if (!storeId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length === 0) {
        return NextResponse.json({
          success: true,
          overview: {
            negotiationsStarted: 0,
            negotiationsCompleted: 0,
            negotiationsAbandoned: 0,
            totalOffersSubmitted: 0,
            totalCounteroffersMade: 0,
            acceptedOffersCount: 0,
            rejectedOffersCount: 0,
            conversionRate: 0,
            negotiationSuccessRate: 0,
            averageOrderValue: 0,
            averageOriginalPrice: 0,
            averageNegotiatedPrice: 0,
            averageDiscountPercentage: 0,
            totalRevenueGenerated: 0,
            totalRevenueRecovered: 0,
            totalMarginProtected: 0,
            currency: "INR",
          },
          revenueRecovery: {
            totalRevenueRecovered: 0,
            totalRevenueGenerated: 0,
            dealsRecoveredCount: 0,
            marginProtectedAmount: 0,
            averageDiscountAmount: 0,
            dataConfidence: "INSUFFICIENT",
            confidenceReason: "No store data available",
            sufficientDataForClaim: false,
          },
          conversionImpact: {
            funnel: {
              sessionsStarted: 0,
              offersSubmitted: 0,
              counteroffersMade: 0,
              offersAccepted: 0,
              couponsIssued: 0,
              ordersConverted: 0,
            },
            offerToAcceptanceRate: 0,
            abandonmentRate: 0,
            dataConfidence: "INSUFFICIENT",
            confidenceReason: "No store data available",
          },
          productPerformance: [],
          negotiationPerformance: {
            roundsDistribution: { round1: 0, round2: 0, round3Plus: 0 },
            averageRoundsToClose: 0,
            averageCustomerConcessionStep: 0,
            aiConcessionVelocity: 0,
            guardrailInterceptionsCount: 0,
          },
          timeBasedTrends: [],
          discountAnalysis: {
            brackets: [],
            averageDiscountPercentage: 0,
            maxDiscountGiven: 0,
            minDiscountGiven: 0,
          },
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

    // Compute complete analytics via AnalyticsService
    const analytics = await AnalyticsService.getStoreAnalytics({
      storeId,
      timeframeDays,
    });

    return NextResponse.json({
      success: true,
      ...analytics,
      // Backward-compatibility aliases
      metrics: {
        totalNegotiations: analytics.overview.negotiationsStarted,
        totalCompleted: analytics.overview.negotiationsCompleted,
        acceptedOffersCount: analytics.overview.acceptedOffersCount,
        conversionRate: analytics.overview.conversionRate,
        averageDiscountPercentage: analytics.overview.averageDiscountPercentage,
        totalNegotiatedRevenue: analytics.overview.totalRevenueGenerated,
        averageNegotiatedPrice: analytics.overview.averageNegotiatedPrice,
        totalMarginProtected: analytics.overview.totalMarginProtected,
        currency: analytics.overview.currency,
      },
      funnel: {
        started: analytics.conversionImpact.funnel.sessionsStarted,
        offered: analytics.conversionImpact.funnel.offersSubmitted,
        countered: analytics.conversionImpact.funnel.counteroffersMade,
        accepted: analytics.conversionImpact.funnel.offersAccepted,
      },
      attemptDistribution: analytics.negotiationPerformance.roundsDistribution,
      productBreakdown: analytics.productPerformance.map((p) => ({
        productId: p.productId,
        title: p.title,
        totalSessions: p.totalSessions,
        acceptedDeals: p.acceptedDeals,
        conversionRate: p.conversionRate,
        totalRevenue: p.totalRevenue,
        avgDiscountPct: p.averageDiscountPercentage,
      })),
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
