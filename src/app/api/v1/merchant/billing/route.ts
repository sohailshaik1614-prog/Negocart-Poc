import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { BillingService } from "@/modules/billing/billing-service";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);

    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "billing:manage");

    const subscription = await BillingService.getMerchantSubscription(authContext.merchantId);
    const plan = BillingService.PLANS[subscription.planId] || BillingService.PLANS.FREE_TRIAL;
    const quota = await BillingService.checkNegotiationQuota(authContext.merchantId);

    const usagePercentage = Math.min(
      100,
      Number(((subscription.monthlyNegotiationsUsed / plan.limits.maxNegotiationsPerMonth) * 100).toFixed(1))
    );

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        planName: plan.name,
        monthlyPriceUsd: plan.monthlyPriceUsd,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      usage: {
        used: subscription.monthlyNegotiationsUsed,
        limit: plan.limits.maxNegotiationsPerMonth,
        percentage: usagePercentage,
        isQuotaExceeded: !quota.allowed,
      },
      availablePlans: Object.values(BillingService.PLANS),
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
