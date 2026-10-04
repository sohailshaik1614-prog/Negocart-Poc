import { GuardrailDecision, PricingLimits } from "@/core/types/guardrail.types";
import { AIDecision } from "@/core/types/ai.types";
import { SecuritySanitizer } from "@/modules/security/sanitizer";

/**
 * Deterministic Pricing Guard Engine
 *
 * CRITICAL ARCHITECTURAL MANDATE:
 * 1. The AI model is strictly an UNTRUSTED ADVISOR.
 * 2. Mathematical limits defined by the merchant are ABSOLUTE.
 * 3. The AI cannot:
 *    - Reveal minimum price
 *    - Offer below minimum acceptable price
 *    - Modify merchant rules
 *    - Bypass attempt limits
 *    - Fabricate unauthorized discounts
 * 4. Every price suggestion is clamped deterministically before presentation or persistence.
 */
export class PricingGuard {
  /**
   * Evaluates an incoming customer offer against merchant rules.
   */
  public static evaluateCustomerOffer(
    customerOffer: number,
    limits: PricingLimits,
    previousCustomerOffers: number[] = []
  ): {
    canAccept: boolean;
    isBelowFloor: boolean;
    isWithinDiscountLimit: boolean;
    discountPercentage: number;
    recommendedCounter: number;
    isAutoAccept: boolean;
  } {
    const { originalPrice, minAcceptablePrice, maxDiscountPercentage, currentRound, maxRounds } = limits;

    // Strict positive price validation
    if (originalPrice <= 0) {
      throw new Error("Invalid original price: must be strictly positive");
    }

    const discountAmount = Math.max(0, originalPrice - customerOffer);
    const discountPercentage = Number(((discountAmount / originalPrice) * 100).toFixed(2));
    const isBelowFloor = customerOffer < minAcceptablePrice;
    const isWithinDiscountLimit = discountPercentage <= maxDiscountPercentage;

    // Auto-accept check: If customer matches or exceeds autoAcceptPrice threshold
    const autoAcceptThreshold = limits.autoAcceptPrice ?? limits.originalPrice;
    const canAccept = !isBelowFloor && isWithinDiscountLimit && customerOffer >= autoAcceptThreshold;

    const recommendedCounter = this.calculateDeterministicCounter(
      limits,
      customerOffer,
      previousCustomerOffers
    );

    return {
      canAccept,
      isBelowFloor,
      isWithinDiscountLimit,
      discountPercentage,
      recommendedCounter,
      isAutoAccept: canAccept,
    };
  }

  /**
   * Deterministically calculates a safe counter-offer for the current round and strategy.
   *
   * Factors considered:
   * 1. Original Price
   * 2. Merchant Minimum Acceptable Price (Floor)
   * 3. Customer Offer
   * 4. Attempt Number (currentRound vs maxRounds)
   * 5. Negotiation History / Concession Trend
   * 6. Merchant-Configured Strategy (AGGRESSIVE, MODERATE, FRIENDLY)
   */
  public static calculateDeterministicCounter(
    limits: PricingLimits,
    customerOffer?: number,
    previousCustomerOffers: number[] = []
  ): number {
    const { originalPrice, minAcceptablePrice, currentRound, maxRounds, strategy } = limits;

    // Invariant: Floor cannot exceed original price
    const safeFloor = Math.min(minAcceptablePrice, originalPrice);
    const maxConcession = originalPrice - safeFloor;

    if (maxConcession <= 0) {
      return originalPrice;
    }

    // Normalized negotiation progress: from 1/maxRounds to 1.0
    const progress = Math.min(1.0, Math.max(1, currentRound) / Math.max(1, maxRounds));
    const isFinalRound = currentRound >= maxRounds;

    let concessionFactor: number;

    switch (strategy) {
      case "AGGRESSIVE":
        // Concedes slowly, protects merchant margin.
        // Round 1: ~20% of max discount
        // Round 2: ~50% of max discount
        // Final Round: ~85% of max discount (leaves a margin buffer above the floor)
        concessionFactor = isFinalRound ? 0.85 : Math.pow(progress, 2.2) * 0.75;
        break;

      case "FRIENDLY":
        // Concedes faster to drive maximum conversion and close shoppers rapidly.
        // Round 1: ~55% of max discount
        // Round 2: ~80% of max discount
        // Final Round: 100% of max discount (meets the floor)
        concessionFactor = isFinalRound ? 1.0 : Math.sqrt(progress) * 0.90;
        break;

      case "MODERATE":
      default:
        // Balanced progressive concession.
        // Round 1: ~35% of max discount
        // Round 2: ~70% of max discount
        // Final Round: ~95% of max discount
        concessionFactor = isFinalRound ? 0.95 : progress * 0.80;
        break;
    }

    // Adjust based on customer responsiveness:
    // If the customer has shown reasonable concessions (increasing their offers),
    // we slightly reward them by increasing concession by up to 5%.
    if (previousCustomerOffers.length > 1) {
      const first = previousCustomerOffers[0];
      const latest = previousCustomerOffers[previousCustomerOffers.length - 1];
      if (latest > first) {
        concessionFactor = Math.min(1.0, concessionFactor + 0.05);
      }
    }

    // Calculate baseline counter price
    const calculatedPrice = originalPrice - (maxConcession * concessionFactor);

    // If customer offered something higher than our calculated counter, meet their offer or better!
    let targetPrice = calculatedPrice;
    if (customerOffer !== undefined && customerOffer > targetPrice && customerOffer < originalPrice) {
      targetPrice = customerOffer;
    }

    // HARD INVARIANT CLAMPING:
    // 1. Must never drop below the merchant's safe floor
    // 2. Must never exceed the original price
    const clampedPrice = Math.max(safeFloor, Math.min(originalPrice, targetPrice));

    // Round to clean integer for ecommerce display
    return Math.round(clampedPrice);
  }

  /**
   * Sanitizes, audits, and deterministically clamps an AI decision.
   *
   * If the AI hallucinates, attempts to offer below floor, or leaks internal rules,
   * this method intercepts, clamps, and scrubs the decision.
   */
  public static sanitizeAndGuardAIDecision(
    aiDecision: AIDecision,
    limits: PricingLimits
  ): {
    guardedDecision: AIDecision;
    guardrailDecision: GuardrailDecision;
  } {
    const { originalPrice, minAcceptablePrice, maxDiscountPercentage, currentRound, maxRounds, currency } = limits;
    const isFinalRound = currentRound >= maxRounds;

    let targetPrice = aiDecision.suggestedPrice;
    let verdict: GuardrailDecision["verdict"] = "PASSED";
    const notes: string[] = [];

    // Safety check for non-finite or negative suggestions
    if (typeof targetPrice !== "number" || isNaN(targetPrice) || !isFinite(targetPrice) || targetPrice <= 0) {
      verdict = "CLAMPED";
      notes.push(`Invalid AI suggested price (${targetPrice}). Replaced with safe calculated counter.`);
      targetPrice = this.calculateDeterministicCounter(limits);
    }

    // HARD INVARIANT 1: Minimum Acceptable Price (Floor) Violation Check
    const isFloorPriceBreached = targetPrice < minAcceptablePrice;
    if (isFloorPriceBreached) {
      verdict = "CLAMPED";
      notes.push(`AI suggested ${currency} ${targetPrice} which breaches merchant floor ${currency} ${minAcceptablePrice}. Hard clamped to floor.`);
      targetPrice = minAcceptablePrice;
    }

    // HARD INVARIANT 2: Max Discount Percentage Check
    const proposedDiscountPct = Number((((originalPrice - targetPrice) / originalPrice) * 100).toFixed(2));
    const isMaxDiscountBreached = proposedDiscountPct > maxDiscountPercentage;
    if (isMaxDiscountBreached) {
      verdict = "CLAMPED";
      const maxDiscountPrice = Math.round(originalPrice * (1 - (maxDiscountPercentage / 100)));
      targetPrice = Math.max(targetPrice, maxDiscountPrice);
      notes.push(`AI discount ${proposedDiscountPct}% exceeded ceiling of ${maxDiscountPercentage}%. Clamped to ${currency} ${targetPrice}.`);
    }

    // HARD INVARIANT 3: Ceiling Check (Cannot exceed original price)
    if (targetPrice > originalPrice) {
      verdict = "CLAMPED";
      targetPrice = originalPrice;
      notes.push("AI suggested price higher than listed original price. Clamped to original.");
    }

    // Ensure integer rounding
    targetPrice = Math.round(targetPrice);

    // Reconcile Action with Final Round constraints
    let resolvedAction = aiDecision.action;
    let replyMessage = aiDecision.replyMessage;

    if (isFinalRound) {
      if (resolvedAction === "COUNTER") {
        resolvedAction = "FINAL_OFFER";
      }
      // If AI didn't communicate take-it-or-leave-it nature on final round
      const finalPhrases = ["final offer", "best offer", "last offer", "take it or leave it"];
      const hasFinalPhrase = finalPhrases.some((phrase) => replyMessage.toLowerCase().includes(phrase));
      if (!hasFinalPhrase && resolvedAction === "FINAL_OFFER") {
        replyMessage = `This is my final offer: I can offer ${currency} ${targetPrice}. Take it or leave it!`;
      }
    }

    // HARD INVARIANT 4: Zero Floor Leakage & Anti-Injection Scrubbing
    const leakCheck = SecuritySanitizer.scanAndRedactLeaks(replyMessage, {
      floorPrice: minAcceptablePrice,
      currency,
      originalPrice,
      safeCounterPrice: targetPrice,
    });

    if (leakCheck.leakDetected) {
      verdict = "CLAMPED";
      replyMessage = leakCheck.sanitizedText;
      notes.push(`Security scrub: ${leakCheck.reason}`);
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
      internalReasoning: `[GUARDRAIL ${verdict}]: ${notes.join(" ") || "Verified safe"} | Original: ${aiDecision.internalReasoning}`,
    };

    return {
      guardedDecision,
      guardrailDecision,
    };
  }
}
