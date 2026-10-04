export type MerchantTier = "STARTER" | "GROWTH" | "ENTERPRISE";
export type UserRole = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";

export interface MerchantSettings {
  defaultMaxRounds?: number;
  defaultStrategy?: "AGGRESSIVE" | "MODERATE" | "FRIENDLY";
  defaultMaxDiscountPercentage?: number;
  notificationEmail?: string;
  autoAcceptThresholdPercentage?: number;
  [key: string]: unknown;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  tier: MerchantTier;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  maxStores: number;
  settings: MerchantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  merchantId: string;
  authUserId?: string;
  email: string;
  fullName: string;
  passwordHash?: string;
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
