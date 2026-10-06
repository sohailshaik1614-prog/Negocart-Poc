export type SubscriptionPlanId =
  | "FREE_TRIAL"
  | "STARTER"
  | "GROWTH"
  | "SCALE"
  | "ENTERPRISE";

export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID";

export interface PlanLimits {
  maxNegotiationsPerMonth: number;
  maxStores: number;
  allowCustomBranding: boolean;
  dedicatedSupport: boolean;
  advancedAnalytics: boolean;
}

export interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  monthlyPriceUsd: number;
  limits: PlanLimits;
  features: string[];
}

export interface MerchantSubscription {
  id: string;
  merchantId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  monthlyNegotiationsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  maxAllowed: number;
  planId: SubscriptionPlanId;
  planName: string;
  reason?: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, any>;
  };
}
