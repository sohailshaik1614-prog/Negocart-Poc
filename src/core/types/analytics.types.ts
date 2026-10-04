export type AnalyticsEventType =
  | "SESSION_STARTED"
  | "OFFER_PROPOSED"
  | "COUNTER_OFFER_MADE"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "COUPON_GENERATED"
  | "CHECKOUT_STARTED"
  | "ORDER_CONVERTED"
  | "GUARDRAIL_TRIGGERED"
  | "SESSION_EXPIRED";

export interface AnalyticsEvent {
  id: string;
  storeId: string;
  sessionId?: string;
  eventType: AnalyticsEventType;
  properties: Record<string, unknown>;
  ipHash?: string;
  occurredAt: string;
}

export interface MerchantOverviewMetrics {
  totalNegotiations: number;
  acceptedOffersCount: number;
  conversionRate: number; // Percentage of sessions that accepted
  averageDiscountPercentage: number;
  totalNegotiatedRevenue: number;
  totalMarginProtected: number;
}
