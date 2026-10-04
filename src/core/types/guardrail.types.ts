import { NegotiationStrategy } from "./rule.types";

export type GuardrailVerdict = "PASSED" | "CLAMPED" | "REJECTED";

export interface PricingLimits {
  originalPrice: number;
  minAcceptablePrice: number; // Floor price
  maxDiscountPercentage: number;
  autoAcceptPrice?: number;
  maxRounds: number;
  currentRound: number;
  strategy: NegotiationStrategy;
  currency: string;
}

export interface GuardrailEvaluationInput {
  proposedPrice: number;
  proposedBy: "CUSTOMER" | "AI_AGENT";
  limits: PricingLimits;
}

export interface GuardrailDecision {
  verdict: GuardrailVerdict;
  allowedPrice: number;
  discountPercentage: number;
  isFloorPriceBreached: boolean;
  isMaxDiscountBreached: boolean;
  isFinalRound: boolean;
  notes: string;
}
