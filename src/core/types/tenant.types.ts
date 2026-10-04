export type MerchantTier = "STARTER" | "GROWTH" | "ENTERPRISE";
export type UserRole = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  tier: MerchantTier;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  maxStores: number;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  merchantId: string;
  authUserId?: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  merchantId: string;
  planTier: MerchantTier;
  status: SubscriptionStatus;
  monthlyNegotiationQuota: number;
  currentCycleNegotiations: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}
