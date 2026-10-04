import { AIDecision, AIPromptContext, INegotiationAIService } from "@/core/types/ai.types";

/**
 * Mock / Deterministic AI Provider
 *
 * Used for local development, automated integration testing, and fallback when
 * external LLM APIs are unreachable or unconfigured.
 */
export class MockNegotiationAIService implements INegotiationAIService {
  public readonly providerName = "mock";

  public async generateNegotiationResponse(context: AIPromptContext): Promise<AIDecision> {
    const {
      customerOffer,
      targetSuggestedCounter,
      minAllowedFloor,
      currentRound,
      maxRounds,
      currency,
    } = context;

    const isFinalRound = currentRound >= maxRounds;

    // Case 1: Customer offer meets or exceeds the recommended counter
    if (customerOffer >= targetSuggestedCounter && customerOffer >= minAllowedFloor) {
      return {
        action: "ACCEPT",
        suggestedPrice: customerOffer,
        replyMessage: `That sounds fair! I can accept ${currency} ${customerOffer}. Let's lock in this deal for you.`,
        internalReasoning: `Customer offer ${customerOffer} meets or exceeds target counter ${targetSuggestedCounter}.`,
      };
    }

    // Case 2: Final round
    if (isFinalRound) {
      // If customer is above minimum floor, meet them or give final counter
      const finalPrice = Math.max(minAllowedFloor, Math.min(targetSuggestedCounter, customerOffer));
      return {
        action: "FINAL_OFFER",
        suggestedPrice: finalPrice,
        replyMessage: `${currency} ${finalPrice} is my final offer. Take it or leave it!`,
        internalReasoning: `Final round reached (${currentRound}/${maxRounds}). Setting strict take-it-or-leave-it price.`,
      };
    }

    // Case 3: Customer offer is below floor or in progressive negotiation
    return {
      action: "COUNTER",
      suggestedPrice: targetSuggestedCounter,
      replyMessage: `I can offer ${currency} ${targetSuggestedCounter}. Does that work for you?`,
      internalReasoning: `Progressive counter-offer in round ${currentRound} targeting ${targetSuggestedCounter}.`,
    };
  }
}
