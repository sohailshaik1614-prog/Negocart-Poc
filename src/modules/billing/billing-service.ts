import crypto from "crypto";
import {
  MerchantSubscription,
  PlanDefinition,
  QuotaCheckResult,
  StripeWebhookEvent,
  SubscriptionPlanId,
} from "@/core/types/billing.types";
import { Logger } from "../monitoring/logger";

export class BillingService {
  public static readonly PLANS: Record<SubscriptionPlanId, PlanDefinition> = {
    FREE_TRIAL: {
      id: "FREE_TRIAL",
      name: "14-Day Free Trial",
      monthlyPriceUsd: 0,
      limits: {
        maxNegotiationsPerMonth: 50,
        maxStores: 1,
        allowCustomBranding: false,
        dedicatedSupport: false,
        advancedAnalytics: true,
      },
      features: ["50 negotiations/mo", "1 Shopify store", "Standard AI negotiation engine"],
    },
    STARTER: {
      id: "STARTER",
      name: "Starter",
      monthlyPriceUsd: 49,
      limits: {
        maxNegotiationsPerMonth: 250,
        maxStores: 1,
        allowCustomBranding: true,
        dedicatedSupport: false,
        advancedAnalytics: true,
      },
      features: ["250 negotiations/mo", "1 store", "Custom brand color", "Analytics dashboard"],
    },
    GROWTH: {
      id: "GROWTH",
      name: "Growth",
      monthlyPriceUsd: 149,
      limits: {
        maxNegotiationsPerMonth: 1500,
        maxStores: 3,
        allowCustomBranding: true,
        dedicatedSupport: true,
        advancedAnalytics: true,
      },
      features: [
        "1,500 negotiations/mo",
        "Up to 3 stores",
        "Intelligence recommendations",
        "Priority webhooks",
      ],
    },
    SCALE: {
      id: "SCALE",
      name: "Scale",
      monthlyPriceUsd: 399,
      limits: {
        maxNegotiationsPerMonth: 6000,
        maxStores: 10,
        allowCustomBranding: true,
        dedicatedSupport: true,
        advancedAnalytics: true,
      },
      features: [
        "6,000 negotiations/mo",
        "Up to 10 stores",
        "Dedicated account manager",
        "Custom API integrations",
      ],
    },
    ENTERPRISE: {
      id: "ENTERPRISE",
      name: "Enterprise",
      monthlyPriceUsd: 999,
      limits: {
        maxNegotiationsPerMonth: 100_000,
        maxStores: 50,
        allowCustomBranding: true,
        dedicatedSupport: true,
        advancedAnalytics: true,
      },
      features: ["Unlimited negotiations", "Custom AI models", "SLA guarantees", "Dedicated VPC"],
    },
  };

  private static subscriptions: Map<string, MerchantSubscription> = new Map([
    // Default subscription for dev/test default merchant
    [
      "a0000000-0000-0000-0000-000000000001",
      {
        id: "sub_apex_default_01",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        stripeCustomerId: "cus_mock_apex_retail",
        stripeSubscriptionId: "sub_mock_apex_growth",
        planId: "GROWTH",
        status: "ACTIVE",
        currentPeriodStart: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 20 * 86400 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        monthlyNegotiationsUsed: 12,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  /**
   * Retrieves active merchant subscription, creating a Free Trial if none exists
   */
  public static async getMerchantSubscription(merchantId: string): Promise<MerchantSubscription> {
    let sub = this.subscriptions.get(merchantId);
    if (!sub) {
      sub = {
        id: crypto.randomUUID(),
        merchantId,
        planId: "FREE_TRIAL",
        status: "TRIALING",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        monthlyNegotiationsUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.subscriptions.set(merchantId, sub);
    }
    return sub;
  }

  /**
   * Verifies if merchant has quota available for an additional negotiation
   */
  public static async checkNegotiationQuota(merchantId: string): Promise<QuotaCheckResult> {
    const sub = await this.getMerchantSubscription(merchantId);
    const plan = this.PLANS[sub.planId] || this.PLANS.FREE_TRIAL;
    const maxAllowed = plan.limits.maxNegotiationsPerMonth;
    const currentUsage = sub.monthlyNegotiationsUsed;

    if (sub.status === "CANCELED" || sub.status === "UNPAID") {
      return {
        allowed: false,
        currentUsage,
        maxAllowed,
        planId: sub.planId,
        planName: plan.name,
        reason: `Subscription is currently ${sub.status.toLowerCase()}. Please update billing details.`,
      };
    }

    if (currentUsage >= maxAllowed) {
      return {
        allowed: false,
        currentUsage,
        maxAllowed,
        planId: sub.planId,
        planName: plan.name,
        reason: `Monthly negotiation limit of ${maxAllowed} reached for ${plan.name} plan. Upgrade to increase volume.`,
      };
    }

    return {
      allowed: true,
      currentUsage,
      maxAllowed,
      planId: sub.planId,
      planName: plan.name,
    };
  }

  /**
   * Increments negotiation counter after a new session initializes
   */
  public static async incrementNegotiationUsage(merchantId: string): Promise<number> {
    const sub = await this.getMerchantSubscription(merchantId);
    sub.monthlyNegotiationsUsed += 1;
    sub.updatedAt = new Date().toISOString();
    return sub.monthlyNegotiationsUsed;
  }

  /**
   * Processes incoming Stripe Webhook events to maintain subscription state
   */
  public static async handleStripeWebhook(
    event: StripeWebhookEvent
  ): Promise<{ handled: boolean; action: string }> {
    const obj = event.data.object;
    Logger.info(`[Stripe Webhook] Received ${event.type}`, { eventId: event.id, type: event.type });

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const merchantId = obj.metadata?.merchantId;
        if (merchantId) {
          const sub = await this.getMerchantSubscription(merchantId);
          sub.stripeCustomerId = obj.customer;
          sub.stripeSubscriptionId = obj.id;
          sub.status = obj.status === "active" ? "ACTIVE" : obj.status === "past_due" ? "PAST_DUE" : "ACTIVE";
          sub.currentPeriodStart = new Date(obj.current_period_start * 1000).toISOString();
          sub.currentPeriodEnd = new Date(obj.current_period_end * 1000).toISOString();
          sub.cancelAtPeriodEnd = obj.cancel_at_period_end || false;
          sub.updatedAt = new Date().toISOString();
        }
        return { handled: true, action: "subscription_synchronized" };
      }

      case "customer.subscription.deleted": {
        const merchantId = obj.metadata?.merchantId;
        if (merchantId) {
          const sub = await this.getMerchantSubscription(merchantId);
          sub.status = "CANCELED";
          sub.updatedAt = new Date().toISOString();
        }
        return { handled: true, action: "subscription_canceled" };
      }

      case "invoice.payment_succeeded": {
        // Reset monthly usage upon new billing period invoice
        const merchantId = obj.subscription_details?.metadata?.merchantId || obj.metadata?.merchantId;
        if (merchantId) {
          const sub = await this.getMerchantSubscription(merchantId);
          sub.monthlyNegotiationsUsed = 0;
          sub.updatedAt = new Date().toISOString();
        }
        return { handled: true, action: "payment_recorded_and_usage_reset" };
      }

      case "invoice.payment_failed": {
        const merchantId = obj.subscription_details?.metadata?.merchantId || obj.metadata?.merchantId;
        if (merchantId) {
          const sub = await this.getMerchantSubscription(merchantId);
          sub.status = "PAST_DUE";
          sub.updatedAt = new Date().toISOString();
        }
        return { handled: true, action: "payment_failed_flagged" };
      }

      default:
        return { handled: false, action: "unhandled_event_type" };
    }
  }

  public static resetForTesting(): void {
    // Re-seed default
    this.subscriptions.set("a0000000-0000-0000-0000-000000000001", {
      id: "sub_apex_default_01",
      merchantId: "a0000000-0000-0000-0000-000000000001",
      stripeCustomerId: "cus_mock_apex_retail",
      stripeSubscriptionId: "sub_mock_apex_growth",
      planId: "GROWTH",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 20 * 86400 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      monthlyNegotiationsUsed: 12,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
}
