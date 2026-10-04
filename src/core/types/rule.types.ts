export type NegotiationStrategy = "AGGRESSIVE" | "MODERATE" | "FRIENDLY";

export interface ProductNegotiationSettings {
  id: string;
  storeId: string;
  productId?: string; // If undefined, applies as store-wide fallback rule
  isNegotiationEnabled: boolean;
  
  /**
   * ABSOLUTE MINIMUM ACCEPTABLE PRICE (FLOOR PRICE).
   * STRICT SECURITY INVARIANT: Must NEVER be leaked or sent to client/storefront.
   */
  minAcceptablePrice: number;
  
  /**
   * Maximum discount percentage (0 to 100)
   */
  maxDiscountPercentage: number;
  
  /**
   * Price threshold at or above which an incoming offer is immediately auto-accepted
   */
  autoAcceptPrice?: number;
  
  /**
   * Maximum rounds allowed before final offer (typically 2-5)
   */
  maxNegotiationRounds: number;
  
  /**
   * Negotiation personality/approach
   * AGGRESSIVE: Concedes slowly, stays close to original price
   * MODERATE: Balanced concessions, fair midpoint
   * FRIENDLY: Concedes more rapidly towards acceptable range to maximize conversion
   */
  strategy: NegotiationStrategy;
  
  minOrderQuantity: number;
  couponValidityHours: number;
  customSystemPromptAddon?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface RuleUpsertDTO {
  productId?: string;
  isNegotiationEnabled: boolean;
  minAcceptablePrice: number;
  maxDiscountPercentage: number;
  autoAcceptPrice?: number;
  maxNegotiationRounds: number;
  strategy: NegotiationStrategy;
  minOrderQuantity?: number;
  couponValidityHours?: number;
  customSystemPromptAddon?: string;
}
