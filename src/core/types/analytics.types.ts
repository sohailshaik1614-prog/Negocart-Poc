export type AnalyticsEventType =
  | "SESSION_STARTED"
  | "OFFER_PROPOSED"
  | "COUNTER_OFFER_MADE"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "SESSION_ABANDONED"
  | "SESSION_COMPLETED"
  | "COUPON_GENERATED"
  | "CHECKOUT_STARTED"
  | "ORDER_CONVERTED"
  | "GUARDRAIL_TRIGGERED"
  | "SESSION_EXPIRED"
  | "STORE_CONNECTED"
  | "STORE_UNINSTALLED";

export interface AnalyticsEvent {
  id: string;
  storeId: string;
  sessionId?: string;
  eventType: AnalyticsEventType;
  properties: Record<string, unknown>;
  ipHash?: string;
  occurredAt: string;
}

export type DataConfidenceLevel = "INSUFFICIENT" | "MODERATE" | "HIGH";

export interface OverviewMetrics {
  negotiationsStarted: number;
  negotiationsCompleted: number;
  negotiationsAbandoned: number;
  totalOffersSubmitted: number;
  totalCounteroffersMade: number;
  acceptedOffersCount: number;
  rejectedOffersCount: number;
  conversionRate: number; // accepted / started * 100
  negotiationSuccessRate: number; // accepted / completed * 100
  averageOrderValue: number;
  averageOriginalPrice: number;
  averageNegotiatedPrice: number;
  averageDiscountPercentage: number;
  totalRevenueGenerated: number;
  totalRevenueRecovered: number;
  totalMarginProtected: number;
  currency: string;
}

export interface RevenueRecoveryMetrics {
  totalRevenueRecovered: number;
  totalRevenueGenerated: number;
  dealsRecoveredCount: number;
  marginProtectedAmount: number;
  averageDiscountAmount: number;
  dataConfidence: DataConfidenceLevel;
  confidenceReason: string;
  sufficientDataForClaim: boolean;
}

export interface ConversionImpactMetrics {
  funnel: {
    sessionsStarted: number;
    offersSubmitted: number;
    counteroffersMade: number;
    offersAccepted: number;
    couponsIssued: number;
    ordersConverted: number;
  };
  offerToAcceptanceRate: number;
  abandonmentRate: number;
  dataConfidence: DataConfidenceLevel;
  confidenceReason: string;
}

export interface ProductPerformance {
  productId: string;
  title: string;
  handle: string;
  originalPrice: number;
  minAcceptablePrice?: number;
  totalSessions: number;
  completedSessions: number;
  acceptedDeals: number;
  conversionRate: number;
  totalRevenue: number;
  averageNegotiatedPrice: number;
  averageDiscountPercentage: number;
  floorUtilizationPercentage: number; // How close to the floor deals are closing
}

export interface NegotiationPerformance {
  roundsDistribution: {
    round1: number;
    round2: number;
    round3Plus: number;
  };
  averageRoundsToClose: number;
  averageCustomerConcessionStep: number;
  aiConcessionVelocity: number;
  guardrailInterceptionsCount: number;
}

export interface TimeBasedTrendPoint {
  date: string; // YYYY-MM-DD
  started: number;
  accepted: number;
  abandoned: number;
  revenue: number;
  averageDiscount: number;
}

export interface DiscountAnalysisBracket {
  range: "0-5%" | "5-10%" | "10-15%" | "15-20%" | "20%+";
  dealCount: number;
  revenue: number;
  percentageOfTotalDeals: number;
}

export interface DiscountAnalysis {
  brackets: DiscountAnalysisBracket[];
  averageDiscountPercentage: number;
  maxDiscountGiven: number;
  minDiscountGiven: number;
}

// ============================================================================
// MODULAR INTELLIGENCE LAYER TYPES
// ============================================================================

export interface CustomerBehaviorSignals {
  averageOfferAggressiveness: number; // e.g. 0.70 means customer offered 30% below retail
  averageConcessionStep: number; // Average currency amount customer increases offer per turn
  customerPatienceRounds: number; // Average attempts before closing or abandoning
  repeatShopperRate: number; // % of sessions from returning customers/devices
  priceSensitivityScore: "LOW" | "MODERATE" | "HIGH";
}

export type OptimizationRecommendationType =
  | "EXPAND_MARGIN"
  | "TIGHTEN_FLOOR"
  | "ADJUST_STRATEGY"
  | "INCREASE_ATTEMPTS"
  | "ENABLE_AUTO_ACCEPT";

export interface ProductOptimizationRecommendation {
  productId: string;
  productTitle: string;
  type: OptimizationRecommendationType;
  severity: "INFO" | "RECOMMENDED" | "ACTION_REQUIRED";
  reason: string;
  suggestedAction: string;
}

export interface DynamicStrategyInsight {
  currentStrategy: string;
  recommendedStrategy: "AGGRESSIVE" | "MODERATE" | "FRIENDLY";
  confidenceScore: number; // 0.0 - 1.0
  basisSummary: string;
}

export interface MerchantIntelligenceReport {
  behaviorSignals: CustomerBehaviorSignals;
  productRecommendations: ProductOptimizationRecommendation[];
  strategyInsights: DynamicStrategyInsight[];
  generatedAt: string;
}

export interface CompleteMerchantAnalyticsPayload {
  overview: OverviewMetrics;
  revenueRecovery: RevenueRecoveryMetrics;
  conversionImpact: ConversionImpactMetrics;
  productPerformance: ProductPerformance[];
  negotiationPerformance: NegotiationPerformance;
  timeBasedTrends: TimeBasedTrendPoint[];
  discountAnalysis: DiscountAnalysis;
  intelligence: MerchantIntelligenceReport;
}
