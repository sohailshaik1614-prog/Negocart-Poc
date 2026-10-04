import { GuardrailDecision, PricingLimits } from "@/core/types/guardrail.types";
import { AIDecision } from "@/core/types/ai.types";

/**
 * Deterministic Pricing Guard Engine
 *
 * CRITICAL ARCHITECTURAL COMPONENT:
 * Enforces hard mathematical limits defined by merchants.
 * The AI model is strictly treated as an UNTRUSTED ADVISOR.
 * Every price suggestion, whether from the customer or the AI,
 * is validated and clamped by this deterministic engine before persistence
 * or presentation to the end-user.
 */
export class PricingGuard {
  /**
   * Evaluates an incoming customer offer against merchant rules.
   */
  public static evaluateCustomerOffer(
    customerOffer: number,
    limits: PricingLimits
  ): {
    canAccept: boolean;
    isBelowFloor: boolean;
    isWithinDiscountLimit: boolean;
    discountPercentage: number;
    recommendedCounter: number;
  } {
    const originalPrice = limits.originalPrice;
    const floorPrice = limits.minAcceptablePrice;
    const maxDiscount = limits.maxDiscountPercentage;

    // Safety checks
    if (originalPrice <= 0) {
      throw new Error("Invalid original price");
    }

    const discountAmount = Math.max(0, originalPrice - customerOffer);
    const discountPercentage = Number(((discountAmount / originalPrice) * 100).toFixed(2));
    const isBelowFloor = customerOffer < floorPrice;
    const isWithinDiscountLimit = discountPercentage <= maxDiscount;

    // Auto-accept check: If merchant specified an auto-accept price and customer matches/exceeds it
    const autoAcceptThreshold = limits.autoAcceptPrice ?? floorPrice;
    const canAccept = !isBelowFloor && isWithinDiscountLimit && customerOffer >= autoAcceptThreshold;

    // Calculate deterministic recommended counter-offer based on negotiation round & strategy
    const recommendedCounter = this.calculateDeterministicCounter(limits);

    return {
      canAccept,
      isBelowFloor,
      isWithinDiscountLimit,
      discountPercentage,
      recommendedCounter,
    };
  }

  /**
   * Deterministically calculates a safe counter-offer for the current round and strategy
   */
  public static calculateDeterministicCounter(limits: PricingLimits): number {
    const { originalPrice, minAcceptablePrice, currentRound, maxRounds, strategy } = limits;
    
    // Safety clamp: floor price cannot exceed original price
    const safeFloor = Math.min(minAcceptablePrice, originalPrice);
    const maxConcession = originalPrice - safeFloor;

    if (maxConcession <= 0) {
      return originalPrice;
    }

    // Normalized progress through negotiation: 0 (start) to 1.0 (final round)
    const progress = Math.min(1.0, currentRound / Math.max(1, maxRounds));

    let concessionFactor: number;

    switch (strategy) {
      case "AGGRESSIVE":
        // Concedes slowly, keeps price high until forced on last round
        // progress^2 curve: low concession early on
        concessionFactor = Math.pow(progress, 2) * 0.75;
        break;

      case "FRIENDLY":
        // Concedes faster to secure the deal and maximize conversion
        // sqrt(progress) curve: higher concession earlier
        concessionFactor = Math.sqrt(progress) * 0.95;
        break;

      case "MODERATE":
      default:
        // Linear progressive concession
        concessionFactor = progress * 0.85;
        break;
    }

    // On final round, offer goes up to 98% of maximum allowable concession (leaving tiny margin above absolute floor)
    if (currentRound >= maxRounds) {
      concessionFactor = 0.95;
    }

    const calculatedPrice = originalPrice - (maxConcession * concessionFactor);

    // INVARIANT ENFORCEMENT: Never below safeFloor, never above originalPrice
    const clampedPrice = Math.max(safeFloor, Math.min(originalPrice, calculatedPrice));
    
    // Round to clean integer/2 decimals for ecommerce display
    return Math.round(clampedPrice);
  }

  /**
   * Intercepts an AI decision and enforces hard limits.
   * If the AI hallucinates, suggests a price below the floor, or gives away too much discount,
   * this method intercepts and rectifies it.
   */
  public static sanitizeAndGuardAIDecision(
    aiDecision: AIDecision,
    limits: PricingLimits
  ): {
    guardedDecision: AIDecision;
    guardrailDecision: GuardrailDecision;
  } {
    const { originalPrice, minAcceptablePrice, maxDiscountPercentage, currentRound, maxRounds } = limits;
    const isFinalRound = currentRound >= maxRounds;

    let targetPrice = aiDecision.suggestedPrice;
    let verdict: GuardrailDecision["verdict"] = "PASSED";
    const notes: string[] = [];

    // Rule 1: Floor Price Violation Check
    const isFloorPriceBreached = targetPrice < minAcceptablePrice;
    if (isFloorPriceBreached) {
      verdict = "CLAMPED";
      notes.push(`AI suggested ₹${targetPrice} which violates merchant floor of ₹${minAcceptablePrice}. Price clamped.`);
      // Enforce floor
      targetPrice = minAcceptablePrice;
    }

    // Rule 2: Max Discount Percentage Check
    const proposedDiscountPct = Number((((originalPrice - targetPrice) / originalPrice) * 100).toFixed(2));
    const isMaxDiscountBreached = proposedDiscountPct > maxDiscountPercentage;
    if (isMaxDiscountBreached) {
      verdict = "CLAMPED";
      const maxDiscountPrice = Math.round(originalPrice * (1 - (maxDiscountPercentage / 100)));
      targetPrice = Math.max(targetPrice, maxDiscountPrice);
      notes.push(`AI discount ${proposedDiscountPct}% exceeded ceiling of ${maxDiscountPercentage}%. Clamped to ₹${targetPrice}.`);
    }

    // Rule 3: Guard against AI returning a price higher than original
    if (targetPrice > originalPrice) {
      verdict = "CLAMPED";
      targetPrice = originalPrice;
      notes.push(`AI suggested price higher than original price. Clamped to original.`);
    }

    // Rule 4: Action reconciliation
    let resolvedAction = aiDecision.action;
    let replyMessage = aiDecision.replyMessage;

    if (isFinalRound && resolvedAction === "COUNTER") {
      resolvedAction = "FINAL_OFFER";
      if (!replyMessage.toLowerCase().includes("final offer") && !replyMessage.toLowerCase().includes("best offer")) {
        replyMessage = `This is my final offer: I can offer it to you for ₹${targetPrice}. Let's make this deal!`;
      }
    }

    // Rule 5: Leak Prevention Filter - Scrub any accidental mention of floor price or internal constraints
    const floorPattern = new RegExp(`\\b(${minAcceptablePrice}|floor|minimum acceptable|merchant limit)\\b`, "gi");
    if (floorPattern.test(replyMessage)) {
      replyMessage = `I can offer you a special price of ₹${targetPrice}. Would that work for you?`;
      notes.push("Potentially sensitive floor/internal keywords scrubbed from customer-facing message.");
    }

    const discountPercentage = Number((((originalPrice - targetPrice) / originalPrice) * 100).toFixed(2));

    const guardrailDecision: GuardrailDecision = {
      verdict,
      allowedPrice: targetPrice,
      discountPercentage,
      isFloorPriceBreached,
      isMaxDiscountBreached,
      isFinalRound,
      notes: notes.join(" ") || "All deterministic pricing constraints satisfied.",
    };

    const guardedDecision: AIDecision = {
      action: resolvedAction,
      suggestedPrice: targetPrice,
      replyMessage,
      internalReasoning: `[GUARDRAIL ${verdict}]: ${notes.join(" ") || "Verified safe"} | Original AI reasoning: ${aiDecision.internalReasoning}`,
    };

    return {
      guardedDecision,
      guardrailDecision,
    };
  }
}
