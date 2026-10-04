import crypto from "crypto";
import {
  CustomerOfferRequest,
  DealAcceptanceResponse,
  NegotiationMessage,
  NegotiationOffer,
  NegotiationSession,
  PublicNegotiationSessionView,
  StartSessionRequest,
} from "@/core/types/negotiation.types";
import { PricingLimits } from "@/core/types/guardrail.types";
import { AIPromptContext } from "@/core/types/ai.types";
import {
  DomainError,
  NegotiationRoundsExceededError,
  ProductNotEligibleError,
  SessionAlreadyClosedError,
  SessionExpiredError,
  StoreNotFoundError,
} from "@/core/errors/domain-errors";
import { NegoZaarRepository } from "@/database/repository";
import { PricingGuard } from "@/modules/rules/pricing-guard";
import { AIFactory } from "@/modules/ai/factory";
import { SessionTokenService } from "@/modules/security/token-service";
import { SecuritySanitizer } from "@/modules/security/sanitizer";
import { NegotiationStateMachine } from "./state-machine";
import { EcommerceAdapterFactory } from "@/modules/ecommerce/factory";

export class NegotiationSessionManager {
  /**
   * Initializes a new negotiation session for a storefront shopper
   */
  public static async startSession(
    req: StartSessionRequest
  ): Promise<{ sessionToken: string; view: PublicNegotiationSessionView }> {
    const store = await NegoZaarRepository.getStoreByPublicKey(req.publicStoreKey);
    if (!store || store.status !== "ACTIVE") {
      throw new StoreNotFoundError();
    }

    const product = await NegoZaarRepository.getProductById(req.productId);
    if (!product || !product.isActive) {
      throw new ProductNotEligibleError("Product not found or inactive");
    }

    const rule = await NegoZaarRepository.getProductRule(store.id, product.id);
    if (!rule || !rule.isNegotiationEnabled) {
      throw new ProductNotEligibleError("Negotiation is not enabled for this product");
    }

    const sessionId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (rule.couponValidityHours || 24) * 3600 * 1000).toISOString();

    const sessionToken = SessionTokenService.generateToken({
      sessionId,
      storeId: store.id,
      productId: product.id,
      customerId,
    });
    const sessionTokenHash = SessionTokenService.hashToken(sessionToken);

    const session: NegotiationSession = {
      id: sessionId,
      storeId: store.id,
      productId: product.id,
      customerId,
      sessionTokenHash,
      status: "ACTIVE",
      currentRound: 0,
      maxRounds: rule.maxNegotiationRounds,
      originalPrice: product.originalPrice,
      currency: product.currency,
      expiresAt,
      metadata: {
        deviceFingerprint: req.deviceFingerprint,
        customerEmail: req.customerEmail,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await NegoZaarRepository.createNegotiationSession(session);

    // Initial greeting message from AI Negotiator
    const initialGreeting = `Hello! I'm NegoZaar, your sales assistant. The listed price for "${product.title}" is ${product.currency} ${product.originalPrice}. What price would you like to offer today?`;

    const initialMsg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sessionId,
      senderRole: "AI_AGENT",
      messageText: initialGreeting,
      roundNumber: 0,
      rawAiReasoning: "Initial opening conversation turn",
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addMessage(initialMsg);

    await NegoZaarRepository.recordAnalyticsEvent({
      id: crypto.randomUUID(),
      storeId: store.id,
      sessionId,
      eventType: "SESSION_STARTED",
      properties: {
        productId: product.id,
        originalPrice: product.originalPrice,
        maxRounds: rule.maxNegotiationRounds,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      sessionToken,
      view: {
        sessionId,
        status: "ACTIVE",
        currentRound: 0,
        maxRounds: rule.maxNegotiationRounds,
        originalPrice: product.originalPrice,
        currency: product.currency,
        product: {
          title: product.title,
          imageUrl: product.imageUrl,
        },
        messages: [
          {
            id: initialMsg.id,
            senderRole: initialMsg.senderRole,
            messageText: initialMsg.messageText,
            roundNumber: 0,
            createdAt: initialMsg.createdAt,
          },
        ],
      },
    };
  }

  /**
   * Processes a customer counter-offer or message
   */
  public static async submitCustomerOffer(
    req: CustomerOfferRequest
  ): Promise<{ view: PublicNegotiationSessionView; dealClosed: boolean }> {
    const payload = SessionTokenService.verifyToken(req.sessionToken);
    const session = await NegoZaarRepository.getSessionById(payload.sessionId);

    if (!session) {
      throw new DomainError("Session not found", 404);
    }

    if (new Date(session.expiresAt) < new Date()) {
      await NegoZaarRepository.updateSessionStatus(session.id, "EXPIRED");
      throw new SessionExpiredError();
    }

    if (NegotiationStateMachine.isTerminal(session.status)) {
      throw new SessionAlreadyClosedError(`Negotiation is already ${session.status.toLowerCase()}`);
    }

    if (session.currentRound >= session.maxRounds) {
      throw new NegotiationRoundsExceededError();
    }

    const product = await NegoZaarRepository.getProductById(session.productId);
    const store = await NegoZaarRepository.getStoreById(session.storeId);
    const rule = await NegoZaarRepository.getProductRule(session.storeId, session.productId);

    if (!product || !store || !rule) {
      throw new DomainError("Associated product, store or rule missing", 500);
    }

    // 1. Sanitize input & parse price
    const parsedAmount = SecuritySanitizer.parseCustomerOffer(req.proposedAmount);
    const sanitizedMsg = SecuritySanitizer.sanitizeCustomerMessage(req.message || "");

    const newRound = await NegoZaarRepository.incrementSessionRound(session.id);

    // 2. Persist customer message & structured offer
    const customerMsg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "CUSTOMER",
      messageText: sanitizedMsg.cleanText || `I'd like to offer ${session.currency} ${parsedAmount}`,
      roundNumber: newRound,
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addMessage(customerMsg);

    const customerDiscountPct = Number(
      (((product.originalPrice - parsedAmount) / product.originalPrice) * 100).toFixed(2)
    );

    const customerOfferRecord: NegotiationOffer = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      roundNumber: newRound,
      proposedBy: "CUSTOMER",
      amount: parsedAmount,
      currency: session.currency,
      discountPercentage: customerDiscountPct,
      guardrailStatus: parsedAmount < rule.minAcceptablePrice ? "REJECTED" : "PASSED",
      guardrailNotes: parsedAmount < rule.minAcceptablePrice ? "Below merchant minimum floor price" : undefined,
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addOffer(customerOfferRecord);

    // 3. Evaluate limits with Deterministic Pricing Guard
    const limits: PricingLimits = {
      originalPrice: product.originalPrice,
      minAcceptablePrice: rule.minAcceptablePrice,
      maxDiscountPercentage: rule.maxDiscountPercentage,
      autoAcceptPrice: rule.autoAcceptPrice,
      maxRounds: rule.maxNegotiationRounds,
      currentRound: newRound,
      strategy: rule.strategy,
      currency: session.currency,
    };

    const evaluation = PricingGuard.evaluateCustomerOffer(parsedAmount, limits);

    // Check Case A: Immediate Auto-Accept
    if (evaluation.canAccept) {
      NegotiationStateMachine.assertTransition(session.status, "ACCEPTED");
      await NegoZaarRepository.updateSessionStatus(session.id, "ACCEPTED", parsedAmount);

      const acceptMsg: NegotiationMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        senderRole: "AI_AGENT",
        messageText: `Deal agreed! I accept your offer of ${session.currency} ${parsedAmount}. Click 'Claim Deal' below to proceed to checkout with your discount pre-applied.`,
        roundNumber: newRound,
        rawAiReasoning: `Auto-accepted offer ${parsedAmount} (at or above threshold ${rule.autoAcceptPrice || rule.minAcceptablePrice}).`,
        createdAt: new Date().toISOString(),
      };
      await NegoZaarRepository.addMessage(acceptMsg);

      await NegoZaarRepository.recordAnalyticsEvent({
        id: crypto.randomUUID(),
        storeId: store.id,
        sessionId: session.id,
        eventType: "OFFER_ACCEPTED",
        properties: { agreedPrice: parsedAmount, round: newRound },
        occurredAt: new Date().toISOString(),
      });

      return {
        view: await this.buildPublicView(session.id),
        dealClosed: true,
      };
    }

    // Check Case B: Negotiation continuation or final offer
    const isFinalRound = newRound >= session.maxRounds;

    // Fetch conversation history for AI prompt context
    const previousMessages = await NegoZaarRepository.getSessionMessages(session.id);
    const aiContext: AIPromptContext = {
      productTitle: product.title,
      originalPrice: product.originalPrice,
      currency: session.currency,
      currentRound: newRound,
      maxRounds: session.maxRounds,
      strategy: rule.strategy,
      customerOffer: parsedAmount,
      targetSuggestedCounter: evaluation.recommendedCounter,
      minAllowedFloor: rule.minAcceptablePrice,
      history: previousMessages.map((m) => ({
        sender: m.senderRole,
        text: m.messageText,
      })),
      merchantToneGuide: rule.customSystemPromptAddon,
    };

    // Invoke AI Service Abstraction
    const aiService = AIFactory.getService();
    const rawAiDecision = await aiService.generateNegotiationResponse(aiContext);

    // CRITICAL: Run AI Decision through Deterministic Pricing Guard
    const { guardedDecision, guardrailDecision } = PricingGuard.sanitizeAndGuardAIDecision(
      rawAiDecision,
      limits
    );

    if (guardrailDecision.verdict !== "PASSED") {
      await NegoZaarRepository.recordAnalyticsEvent({
        id: crypto.randomUUID(),
        storeId: store.id,
        sessionId: session.id,
        eventType: "GUARDRAIL_TRIGGERED",
        properties: {
          originalSuggestion: rawAiDecision.suggestedPrice,
          clampedPrice: guardedDecision.suggestedPrice,
          verdict: guardrailDecision.verdict,
          notes: guardrailDecision.notes,
        },
        occurredAt: new Date().toISOString(),
      });
    }

    // Determine state transition
    let nextStatus: NegotiationSession["status"] = "COUNTERED";
    if (guardedDecision.action === "ACCEPT") {
      nextStatus = "ACCEPTED";
    }

    NegotiationStateMachine.assertTransition(session.status, nextStatus);
    await NegoZaarRepository.updateSessionStatus(
      session.id,
      nextStatus,
      nextStatus === "ACCEPTED" ? guardedDecision.suggestedPrice : undefined
    );

    // Save AI Agent Response Message
    const agentMsg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "AI_AGENT",
      messageText: guardedDecision.replyMessage,
      roundNumber: newRound,
      rawAiReasoning: guardedDecision.internalReasoning,
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addMessage(agentMsg);

    // Save Structured AI Offer Record
    const agentOfferRecord: NegotiationOffer = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      roundNumber: newRound,
      proposedBy: "AI_AGENT",
      amount: guardedDecision.suggestedPrice,
      currency: session.currency,
      discountPercentage: guardrailDecision.discountPercentage,
      guardrailStatus: guardrailDecision.verdict,
      guardrailNotes: guardrailDecision.notes,
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addOffer(agentOfferRecord);

    await NegoZaarRepository.recordAnalyticsEvent({
      id: crypto.randomUUID(),
      storeId: store.id,
      sessionId: session.id,
      eventType: "COUNTER_OFFER_MADE",
      properties: {
        amount: guardedDecision.suggestedPrice,
        round: newRound,
        isFinalRound,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      view: await this.buildPublicView(session.id),
      dealClosed: nextStatus === "ACCEPTED",
    };
  }

  /**
   * Finalizes the deal and generates a store-native discount coupon
   */
  public static async claimDeal(sessionToken: string): Promise<DealAcceptanceResponse> {
    const payload = SessionTokenService.verifyToken(sessionToken);
    const session = await NegoZaarRepository.getSessionById(payload.sessionId);

    if (!session) {
      throw new DomainError("Session not found", 404);
    }

    const product = await NegoZaarRepository.getProductById(session.productId);
    const store = await NegoZaarRepository.getStoreById(session.storeId);
    const rule = await NegoZaarRepository.getProductRule(session.storeId, session.productId);

    if (!product || !store || !rule) {
      throw new DomainError("Associated session entities missing", 500);
    }

    // Determine final price: if already ACCEPTED, use finalAgreedPrice;
    // if COUNTERED, the customer is accepting the AI's latest counter-offer!
    let agreedPrice = session.finalAgreedPrice;

    if (!agreedPrice) {
      const messages = await NegoZaarRepository.getSessionMessages(session.id);
      // Find latest agent proposal amount
      const agentOffers = (await NegoZaarRepository.getRecentSessions(store.id)).find(
        (s) => s.id === session.id
      );
      // Deterministically fallback to recommended counter or minimum rule if not set
      agreedPrice = rule.minAcceptablePrice;
    }

    // Pricing Guard final sanity check
    if (agreedPrice < rule.minAcceptablePrice) {
      agreedPrice = rule.minAcceptablePrice;
    }

    // Ensure session status is ACCEPTED
    await NegoZaarRepository.updateSessionStatus(session.id, "ACCEPTED", agreedPrice);

    const discountAmount = Math.max(0, product.originalPrice - agreedPrice);

    // Call platform adapter to issue coupon
    const platformAdapter = EcommerceAdapterFactory.getAdapter(store.platform);
    const couponResult = await platformAdapter.createDiscountCoupon(
      {
        storeId: store.id,
        code: "",
        discountAmount,
        originalPrice: product.originalPrice,
        negotiatedPrice: agreedPrice,
        currency: session.currency,
        productId: product.externalProductId,
        expiresInHours: rule.couponValidityHours || 24,
        singleUse: true,
      },
      { shopDomain: store.platformStoreId, accessToken: "mock_token" }
    );

    // Record Transaction
    await NegoZaarRepository.createTransaction({
      id: crypto.randomUUID(),
      sessionId: session.id,
      storeId: store.id,
      discountCode: couponResult.code,
      claimToken: crypto.randomBytes(16).toString("hex"),
      status: "GENERATED",
      originalPrice: product.originalPrice,
      negotiatedPrice: agreedPrice,
      discountAmount,
      currency: session.currency,
      expiresAt: couponResult.expiresAt,
      createdAt: new Date().toISOString(),
    });

    await NegoZaarRepository.recordAnalyticsEvent({
      id: crypto.randomUUID(),
      storeId: store.id,
      sessionId: session.id,
      eventType: "COUPON_GENERATED",
      properties: {
        code: couponResult.code,
        discountAmount,
        finalPrice: agreedPrice,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      success: true,
      agreedPrice,
      discountCode: couponResult.code,
      checkoutUrl: couponResult.checkoutUrl,
      expiresAt: couponResult.expiresAt,
    };
  }

  /**
   * Helper to build a clean client-safe view (guaranteed zero-leak of floor price)
   */
  public static async buildPublicView(sessionId: string): Promise<PublicNegotiationSessionView> {
    const session = await NegoZaarRepository.getSessionById(sessionId);
    if (!session) throw new DomainError("Session not found", 404);

    const product = await NegoZaarRepository.getProductById(session.productId);
    const messages = await NegoZaarRepository.getSessionMessages(sessionId);

    return {
      sessionId: session.id,
      status: session.status,
      currentRound: session.currentRound,
      maxRounds: session.maxRounds,
      originalPrice: session.originalPrice,
      currentOffer: session.finalAgreedPrice,
      currency: session.currency,
      product: {
        title: product?.title || "Product",
        imageUrl: product?.imageUrl,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        messageText: m.messageText,
        roundNumber: m.roundNumber,
        createdAt: m.createdAt,
      })),
    };
  }
}
