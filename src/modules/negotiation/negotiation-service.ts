import { AIDecision, AIPromptContext, AIProvider } from "@/core/types/ai.types";
import { PricingLimits } from "@/core/types/guardrail.types";
import { PricingGuard } from "@/modules/rules/pricing-guard";
import { NegotiationStateMachine } from "./state-machine";
import { AIFactory } from "@/modules/ai/factory";
import { SecuritySanitizer } from "@/modules/security/sanitizer";

export interface NegotiationTurnInput {
  productTitle: string;
  originalPrice: number;
  currency: string;
  customerOffer: number;
  customerMessage?: string;
  currentAttempt: number;
  maxAttempts: number;
  limits: PricingLimits;
  history: Array<{ sender: "CUSTOMER" | "AI_AGENT" | "SYSTEM"; text: string }>;
  offerHistory?: Array<{ round: number; amount: number; proposedBy: "CUSTOMER" | "AI_AGENT" }>;
  merchantToneGuide?: string;
}

export interface NegotiationTurnOutput {
  action: "COUNTER" | "ACCEPT" | "REJECT" | "FINAL_OFFER";
  decisionPrice: number;
  customerReply: string;
  guardrailVerdict: "PASSED" | "CLAMPED" | "REJECTED";
  isFinalRound: boolean;
  internalReasoning: string;
  sanitization: {
    cleanText: string;
    isSuspicious: boolean;
    isFloorProbe: boolean;
  };
}

/**
 * NegotiationService
 *
 * Clean decoupled architectural service orchestrating:
 * - AI Provider (untrusted conversational advisor)
 * - Pricing Guard (deterministic mathematical authority)
 * - Security Sanitizer (untrusted input & leak defense)
 * - State Machine (state transition invariants)
 */
export class NegotiationService {
  constructor(
    private readonly aiProvider: AIProvider = AIFactory.getService(),
    private readonly pricingGuard: typeof PricingGuard = PricingGuard,
    private readonly stateMachine: typeof NegotiationStateMachine = NegotiationStateMachine,
    private readonly sanitizer: typeof SecuritySanitizer = SecuritySanitizer
  ) {}

  /**
   * Evaluates a customer negotiation move and produces a margin-protected response
   */
  public async processCustomerTurn(input: NegotiationTurnInput): Promise<NegotiationTurnOutput> {
    const {
      productTitle,
      originalPrice,
      currency,
      customerOffer,
      customerMessage = "",
      currentAttempt,
      maxAttempts,
      limits,
      history,
      offerHistory = [],
      merchantToneGuide,
    } = input;

    // 1. Sanitize untrusted customer input
    const sanitization = this.sanitizer.sanitizeCustomerMessage(customerMessage);

    // 2. Pre-evaluate offer with Deterministic Pricing Guard
    const customerOfferHistory = offerHistory
      .filter((o) => o.proposedBy === "CUSTOMER")
      .map((o) => o.amount);

    const evaluation = this.pricingGuard.evaluateCustomerOffer(
      customerOffer,
      limits,
      customerOfferHistory
    );

    const isFinalRound = currentAttempt >= maxAttempts;

    // 3. Fast-path: Immediate acceptance if offer satisfies autoAcceptPrice
    if (evaluation.canAccept && (evaluation.isAutoAccept || isFinalRound)) {
      return {
        action: "ACCEPT",
        decisionPrice: customerOffer,
        customerReply: `Deal agreed! I accept your offer of ${currency} ${customerOffer}. Let's lock in your special price!`,
        guardrailVerdict: "PASSED",
        isFinalRound,
        internalReasoning: `Deterministic auto-accept: offer ${customerOffer} meets merchant criteria.`,
        sanitization,
      };
    }

    // 4. Prepare context for AI Provider
    const aiContext: AIPromptContext = {
      productTitle,
      originalPrice,
      currency,
      currentRound: currentAttempt,
      maxRounds: maxAttempts,
      strategy: limits.strategy,
      customerOffer,
      targetSuggestedCounter: evaluation.recommendedCounter,
      minAllowedFloor: limits.minAcceptablePrice,
      history,
      offerHistory,
      merchantToneGuide,
      isSuspiciousInput: sanitization.isSuspicious || sanitization.isFloorProbe,
    };

    // 5. Generate conversational proposal from AI Provider
    const rawAiDecision: AIDecision = await this.aiProvider.generateNegotiationResponse(aiContext);

    // 6. Pass AI decision through Deterministic Pricing Guard
    const { guardedDecision, guardrailDecision } = this.pricingGuard.sanitizeAndGuardAIDecision(
      rawAiDecision,
      limits
    );

    return {
      action: guardedDecision.action,
      decisionPrice: guardedDecision.suggestedPrice,
      customerReply: guardedDecision.replyMessage,
      guardrailVerdict: guardrailDecision.verdict,
      isFinalRound,
      internalReasoning: guardedDecision.internalReasoning,
      sanitization,
    };
  }
}
