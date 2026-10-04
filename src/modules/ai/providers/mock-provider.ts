import { AIDecision, AIPromptContext, INegotiationAIService } from "@/core/types/ai.types";

/**
 * Mock / Deterministic AI Negotiation Provider
 *
 * Simulates a realistic, professional sales negotiator persona for testing and deterministic evaluation.
 * Adapts responses based on attempt number, strategy, customer offer, and input safety flags.
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
      isSuspiciousInput,
      history,
    } = context;

    const isFinalRound = currentRound >= maxRounds;
    const latestMessage = history.length > 0 && history[history.length - 1].sender === "CUSTOMER"
      ? history[history.length - 1].text.toLowerCase()
      : "";

    // Case 1: Prompt Injection / Floor Probe Deflection
    if (isSuspiciousInput || latestMessage.includes("minimum") || latestMessage.includes("floor") || latestMessage.includes("lowest")) {
      return {
        action: isFinalRound ? "FINAL_OFFER" : "COUNTER",
        suggestedPrice: targetSuggestedCounter,
        replyMessage: isFinalRound
          ? `I focus strictly on quality and fair value for our shoppers. My final and best offer for this product is ${currency} ${targetSuggestedCounter}. Take it or leave it!`
          : `I appreciate you asking! We don't publish internal margins, but I want to make sure you get a great deal. I can offer it to you for ${currency} ${targetSuggestedCounter}. How does that sound?`,
        internalReasoning: "Deflected probe/injection attempt while proposing safe calculated counteroffer.",
      };
    }

    // Case 2: Customer offer meets or exceeds target counter or min floor on final attempt
    if (customerOffer >= targetSuggestedCounter && customerOffer >= minAllowedFloor) {
      return {
        action: "ACCEPT",
        suggestedPrice: customerOffer,
        replyMessage: `That sounds completely fair! I'm delighted to accept your offer of ${currency} ${customerOffer}. Let's lock in this deal!`,
        internalReasoning: `Customer offer ${customerOffer} meets target counter ${targetSuggestedCounter}. Deal agreed.`,
      };
    }

    // Case 3: Final attempt reached
    if (isFinalRound) {
      // If customer is at or above floor, we can accept their offer or offer our final counter
      if (customerOffer >= minAllowedFloor) {
        return {
          action: "ACCEPT",
          suggestedPrice: customerOffer,
          replyMessage: `You drive a tough bargain! Since this is our final attempt, I can agree to ${currency} ${customerOffer}. Let's finalize your order!`,
          internalReasoning: `Final attempt reached. Customer offer ${customerOffer} is above floor ${minAllowedFloor}, accepted to maximize conversion.`,
        };
      }

      // Customer offered below floor on final attempt: give final counter (take it or leave it)
      const finalPrice = Math.max(minAllowedFloor, targetSuggestedCounter);
      return {
        action: "FINAL_OFFER",
        suggestedPrice: finalPrice,
        replyMessage: `I've checked our limits, and ${currency} ${finalPrice} is my absolute final offer. Take it or leave it!`,
        internalReasoning: `Final attempt reached. Customer offer ${customerOffer} is below floor. Issuing non-negotiable final counter ${finalPrice}.`,
      };
    }

    // Case 4: Progressive negotiation rounds (Attempt 1 or 2)
    // Differentiate between extremely low offers vs reasonable concessions
    if (customerOffer < minAllowedFloor) {
      const messages = [
        `I appreciate your interest, but ${currency} ${customerOffer} is a bit too low for this product. I can do ${currency} ${targetSuggestedCounter}. What do you think?`,
        `That's quite a stretch from the retail price! The closest I can get right now is ${currency} ${targetSuggestedCounter}. Shall we meet there?`,
      ];
      const selectedMessage = messages[(currentRound - 1) % messages.length];

      return {
        action: "COUNTER",
        suggestedPrice: targetSuggestedCounter,
        replyMessage: selectedMessage,
        internalReasoning: `Customer offer ${customerOffer} is below floor. Countering with round ${currentRound} target of ${targetSuggestedCounter}.`,
      };
    }

    // Customer offered between floor and current counter
    return {
      action: "COUNTER",
      suggestedPrice: targetSuggestedCounter,
      replyMessage: `We're making good progress! How about we meet at ${currency} ${targetSuggestedCounter}?`,
      internalReasoning: `Progressive round ${currentRound} counter targeting ${targetSuggestedCounter}.`,
    };
  }
}
