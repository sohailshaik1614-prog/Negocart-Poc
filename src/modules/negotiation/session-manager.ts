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

export interface StartNegotiationDTO {
  publicStoreKey?: string;
  storeId?: string;
  productId: string;
  cartReference?: string;
  deviceFingerprint?: string;
  customerEmail?: string;
}

export interface SubmitOfferDTO {
  sessionId?: string;
  sessionToken?: string;
  proposedAmount: number;
  message?: string;
}

export interface CounterofferResult {
  sessionId: string;
  attemptNumber: number;
  maxAttempts: number;
  counterPrice: number;
  discountPercentage: number;
  isFinalOffer: boolean;
  message: string;
  status: NegotiationSession["status"];
  guardrailVerdict: "PASSED" | "CLAMPED" | "REJECTED";
}

export class NegotiationSessionManager {
  /**
   * Initializes a new negotiation session for a storefront shopper
   */
  public static async startSession(
    req: StartNegotiationDTO
  ): Promise<{ sessionToken: string; session: NegotiationSession; view: PublicNegotiationSessionView }> {
    let store = req.publicStoreKey
      ? await NegoZaarRepository.getStoreByPublicKey(req.publicStoreKey)
      : req.storeId
      ? await NegoZaarRepository.getStoreById(req.storeId)
      : null;

    if (!store || store.status !== "ACTIVE") {
      throw new StoreNotFoundError("Active store not found for given key or ID");
    }

    const product = await NegoZaarRepository.getProductById(req.productId);
    if (!product || !product.isActive) {
      throw new ProductNotEligibleError("Product not found or inactive");
    }

    // Verify product belongs to store
    if (product.storeId !== store.id) {
      throw new ProductNotEligibleError("Product does not belong to the specified store");
    }

    const rule = await NegoZaarRepository.getProductRule(store.id, product.id);
    if (!rule || !rule.isNegotiationEnabled) {
      throw new ProductNotEligibleError("Negotiation is not enabled for this product");
    }

    const sessionId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (rule.couponValidityHours || 24) * 3600 * 1000).toISOString();
    const now = new Date().toISOString();

    const sessionToken = SessionTokenService.generateToken({
      sessionId,
      storeId: store.id,
      productId: product.id,
      customerId,
    });
    const sessionTokenHash = SessionTokenService.hashToken(sessionToken);

    const session: NegotiationSession = {
      id: sessionId,
      merchantId: store.merchantId,
      storeId: store.id,
      productId: product.id,
      cartReference: req.cartReference,
      customerId,
      sessionTokenHash,
      status: "ACTIVE",
      currentRound: 0,
      attemptNumber: 0,
      maxRounds: rule.maxNegotiationRounds,
      maxAttempts: rule.maxNegotiationRounds,
      originalPrice: product.originalPrice,
      currentOffer: undefined,
      currency: product.currency,
      expiresAt,
      metadata: {
        deviceFingerprint: req.deviceFingerprint || "anonymous_device",
        customerEmail: req.customerEmail,
      },
      createdAt: now,
      updatedAt: now,
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
      attemptNumber: 0,
      aiResponse: initialGreeting,
      rawAiReasoning: "Initial opening conversation turn",
      createdAt: now,
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
        maxAttempts: rule.maxNegotiationRounds,
      },
      occurredAt: now,
    });

    const publicView: PublicNegotiationSessionView = {
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
    };

    return {
      sessionToken,
      session,
      view: publicView,
    };
  }

  /**
   * Helper to resolve session from either sessionToken or direct sessionId
   */
  private static async resolveSession(
    sessionToken?: string,
    sessionId?: string
  ): Promise<NegotiationSession> {
    let resolvedId = sessionId;

    if (sessionToken) {
      const payload = SessionTokenService.verifyToken(sessionToken);
      resolvedId = payload.sessionId;
    }

    if (!resolvedId) {
      throw new DomainError("Session token or session ID must be provided", 400, "MISSING_SESSION");
    }

    const session = await NegoZaarRepository.getSessionById(resolvedId);
    if (!session) {
      throw new DomainError("Negotiation session not found", 404, "SESSION_NOT_FOUND");
    }

    return session;
  }

  /**
   * Submits a customer offer and generates a counteroffer or acceptance
   */
  public static async submitCustomerOffer(
    req: SubmitOfferDTO
  ): Promise<{
    session: NegotiationSession;
    view: PublicNegotiationSessionView;
    dealClosed: boolean;
    counteroffer?: CounterofferResult;
  }> {
    const session = await this.resolveSession(req.sessionToken, req.sessionId);

    // Validate expiration
    if (new Date(session.expiresAt) < new Date()) {
      await NegoZaarRepository.updateSessionStatus(session.id, "EXPIRED");
      throw new SessionExpiredError("Negotiation session has expired");
    }

    // Validate terminal status
    if (NegotiationStateMachine.isTerminal(session.status)) {
      throw new SessionAlreadyClosedError(`Negotiation is already ${session.status.toLowerCase()}`);
    }

    // Validate attempts limit
    const currentAttempt = session.attemptNumber || session.currentRound;
    if (currentAttempt >= session.maxAttempts) {
      throw new NegotiationRoundsExceededError("Maximum negotiation attempts reached");
    }

    const product = await NegoZaarRepository.getProductById(session.productId);
    const store = await NegoZaarRepository.getStoreById(session.storeId);
    const rule = await NegoZaarRepository.getProductRule(session.storeId, session.productId);

    if (!product || !store || !rule) {
      throw new DomainError("Associated product, store or pricing rules missing", 500);
    }

    // 1. Sanitize customer inputs & parse offer
    const parsedAmount = SecuritySanitizer.parseCustomerOffer(req.proposedAmount);
    const sanitizedMsg = SecuritySanitizer.sanitizeCustomerMessage(req.message || "");
    const now = new Date().toISOString();

    const newAttempt = await NegoZaarRepository.incrementSessionAttempt(session.id);

    // 2. Persist customer message & structured offer
    const customerMsgText = sanitizedMsg.cleanText || `I offer ${session.currency} ${parsedAmount}`;
    const customerMsg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "CUSTOMER",
      messageText: customerMsgText,
      roundNumber: newAttempt,
      attemptNumber: newAttempt,
      customerMessage: customerMsgText,
      associatedOffer: parsedAmount,
      createdAt: now,
    };
    await NegoZaarRepository.addMessage(customerMsg);

    const customerDiscountPct = Number(
      (((product.originalPrice - parsedAmount) / product.originalPrice) * 100).toFixed(2)
    );

    const isBelowFloor = parsedAmount < rule.minAcceptablePrice;
    const customerOfferRecord: NegotiationOffer = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      roundNumber: newAttempt,
      attemptNumber: newAttempt,
      proposedBy: "CUSTOMER",
      amount: parsedAmount,
      currency: session.currency,
      discountPercentage: customerDiscountPct,
      guardrailStatus: isBelowFloor ? "REJECTED" : "PASSED",
      guardrailNotes: isBelowFloor ? "Below merchant minimum acceptable floor price" : undefined,
      createdAt: now,
    };
    await NegoZaarRepository.addOffer(customerOfferRecord);

    // Update session current offer to customer's offer
    await NegoZaarRepository.updateSessionOffer(session.id, parsedAmount);

    // 3. Evaluate limits with Deterministic Pricing Guard
    const limits: PricingLimits = {
      originalPrice: product.originalPrice,
      minAcceptablePrice: rule.minAcceptablePrice,
      maxDiscountPercentage: rule.maxDiscountPercentage,
      autoAcceptPrice: rule.autoAcceptPrice,
      maxRounds: session.maxAttempts,
      currentRound: newAttempt,
      strategy: rule.strategy,
      currency: session.currency,
    };

    const evaluation = PricingGuard.evaluateCustomerOffer(parsedAmount, limits);

    // Check Case A: Immediate Auto-Acceptance
    if (evaluation.canAccept) {
      NegotiationStateMachine.assertTransition(session.status, "ACCEPTED");
      await NegoZaarRepository.updateSessionStatus(session.id, "ACCEPTED", parsedAmount);

      const acceptMsgText = `Deal agreed! I accept your offer of ${session.currency} ${parsedAmount}. Click 'Claim Deal' to lock in your price.`;
      const acceptMsg: NegotiationMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        senderRole: "AI_AGENT",
        messageText: acceptMsgText,
        roundNumber: newAttempt,
        attemptNumber: newAttempt,
        aiResponse: acceptMsgText,
        associatedOffer: parsedAmount,
        rawAiReasoning: `Auto-accepted offer ${parsedAmount} (at or above threshold ${rule.autoAcceptPrice || rule.minAcceptablePrice}).`,
        createdAt: new Date().toISOString(),
      };
      await NegoZaarRepository.addMessage(acceptMsg);

      await NegoZaarRepository.recordAnalyticsEvent({
        id: crypto.randomUUID(),
        storeId: store.id,
        sessionId: session.id,
        eventType: "OFFER_ACCEPTED",
        properties: { agreedPrice: parsedAmount, attempt: newAttempt },
        occurredAt: new Date().toISOString(),
      });

      const updatedSession = (await NegoZaarRepository.getSessionById(session.id))!;
      return {
        session: updatedSession,
        view: await this.buildPublicView(session.id),
        dealClosed: true,
      };
    }

    // Check Case B: Counteroffer Generation (AI + Deterministic Guard)
    const counteroffer = await this.executeCounterofferGeneration(
      session,
      product,
      store,
      rule,
      parsedAmount,
      newAttempt,
      evaluation.recommendedCounter
    );

    const updatedSession = (await NegoZaarRepository.getSessionById(session.id))!;
    return {
      session: updatedSession,
      view: await this.buildPublicView(session.id),
      dealClosed: counteroffer.status === "ACCEPTED",
      counteroffer,
    };
  }

  /**
   * Internal counteroffer generator coordinating AI and the Deterministic Pricing Guard
   */
  private static async executeCounterofferGeneration(
    session: NegotiationSession,
    product: { title: string; originalPrice: number },
    store: { id: string },
    rule: {
      minAcceptablePrice: number;
      maxDiscountPercentage: number;
      strategy: any;
      customSystemPromptAddon?: string;
    },
    customerOffer: number,
    attemptNumber: number,
    recommendedCounter: number
  ): Promise<CounterofferResult> {
    const isFinalRound = attemptNumber >= session.maxAttempts;
    const limits: PricingLimits = {
      originalPrice: product.originalPrice,
      minAcceptablePrice: rule.minAcceptablePrice,
      maxDiscountPercentage: rule.maxDiscountPercentage,
      maxRounds: session.maxAttempts,
      currentRound: attemptNumber,
      strategy: rule.strategy,
      currency: session.currency,
    };

    // Prepare AI Prompt Context
    const previousMessages = await NegoZaarRepository.getSessionMessages(session.id);
    const aiContext: AIPromptContext = {
      productTitle: product.title,
      originalPrice: product.originalPrice,
      currency: session.currency,
      currentRound: attemptNumber,
      maxRounds: session.maxAttempts,
      strategy: rule.strategy,
      customerOffer,
      targetSuggestedCounter: recommendedCounter,
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

    // CRITICAL: Enforce Deterministic Pricing Guard
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
          attempt: attemptNumber,
          originalSuggestion: rawAiDecision.suggestedPrice,
          clampedPrice: guardedDecision.suggestedPrice,
          verdict: guardrailDecision.verdict,
          notes: guardrailDecision.notes,
        },
        occurredAt: new Date().toISOString(),
      });
    }

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
    await NegoZaarRepository.updateSessionOffer(session.id, guardedDecision.suggestedPrice, nextStatus);

    // Save AI Agent Response Message
    const agentMsg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "AI_AGENT",
      messageText: guardedDecision.replyMessage,
      roundNumber: attemptNumber,
      attemptNumber,
      aiResponse: guardedDecision.replyMessage,
      associatedOffer: guardedDecision.suggestedPrice,
      rawAiReasoning: guardedDecision.internalReasoning,
      createdAt: new Date().toISOString(),
    };
    await NegoZaarRepository.addMessage(agentMsg);

    // Save Structured AI Offer Record
    const agentOfferRecord: NegotiationOffer = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      roundNumber: attemptNumber,
      attemptNumber,
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
        attempt: attemptNumber,
        isFinalRound,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      sessionId: session.id,
      attemptNumber,
      maxAttempts: session.maxAttempts,
      counterPrice: guardedDecision.suggestedPrice,
      discountPercentage: guardrailDecision.discountPercentage,
      isFinalOffer: isFinalRound,
      message: guardedDecision.replyMessage,
      status: nextStatus,
      guardrailVerdict: guardrailDecision.verdict,
    };
  }

  /**
   * Generates or regenerates a counteroffer explicitly for a session
   */
  public static async generateCounteroffer(
    sessionId: string,
    sessionToken?: string
  ): Promise<CounterofferResult> {
    const session = await this.resolveSession(sessionToken, sessionId);

    if (NegotiationStateMachine.isTerminal(session.status)) {
      throw new SessionAlreadyClosedError(`Negotiation is already ${session.status.toLowerCase()}`);
    }

    const product = await NegoZaarRepository.getProductById(session.productId);
    const store = await NegoZaarRepository.getStoreById(session.storeId);
    const rule = await NegoZaarRepository.getProductRule(session.storeId, session.productId);

    if (!product || !store || !rule) {
      throw new DomainError("Associated entities missing", 500);
    }

    const currentAttempt = session.attemptNumber || session.currentRound || 1;
    const limits: PricingLimits = {
      originalPrice: product.originalPrice,
      minAcceptablePrice: rule.minAcceptablePrice,
      maxDiscountPercentage: rule.maxDiscountPercentage,
      autoAcceptPrice: rule.autoAcceptPrice,
      maxRounds: session.maxAttempts,
      currentRound: currentAttempt,
      strategy: rule.strategy,
      currency: session.currency,
    };

    const recommendedCounter = PricingGuard.calculateDeterministicCounter(limits);
    const customerOffer = session.currentOffer || product.originalPrice;

    return this.executeCounterofferGeneration(
      session,
      product,
      store,
      rule,
      customerOffer,
      currentAttempt,
      recommendedCounter
    );
  }

  /**
   * Explicitly accepts the current or agreed offer and closes the negotiation
   */
  public static async acceptFinalOffer(
    sessionId: string,
    sessionToken?: string
  ): Promise<DealAcceptanceResponse> {
    const session = await this.resolveSession(sessionToken, sessionId);

    if (session.status === "ACCEPTED" && session.finalAgreedPrice) {
      // Already accepted, retrieve claim
      return this.claimDeal(sessionToken || "");
    }

    if (["REJECTED", "EXPIRED", "TERMINATED"].includes(session.status)) {
      throw new SessionAlreadyClosedError(`Cannot accept an offer for an ${session.status.toLowerCase()} session`);
    }

    const product = await NegoZaarRepository.getProductById(session.productId);
    const store = await NegoZaarRepository.getStoreById(session.storeId);
    const rule = await NegoZaarRepository.getProductRule(session.storeId, session.productId);

    if (!product || !store || !rule) {
      throw new DomainError("Associated session entities missing", 500);
    }

    // Determine agreed price: currentOffer, or floor price if none
    let agreedPrice = session.currentOffer || session.finalAgreedPrice || rule.minAcceptablePrice;

    // Hard guardrail invariant check: agreed price can NEVER be below floor
    if (agreedPrice < rule.minAcceptablePrice) {
      agreedPrice = rule.minAcceptablePrice;
    }

    NegotiationStateMachine.assertTransition(session.status, "ACCEPTED");
    await NegoZaarRepository.updateSessionStatus(session.id, "ACCEPTED", agreedPrice);

    const discountAmount = Math.max(0, product.originalPrice - agreedPrice);

    // Generate coupon claim
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
      eventType: "OFFER_ACCEPTED",
      properties: { agreedPrice, discountCode: couponResult.code },
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
   * Explicitly rejects an offer and marks the session as REJECTED
   */
  public static async rejectOffer(
    sessionId: string,
    reason?: string,
    sessionToken?: string
  ): Promise<{ success: boolean; session: NegotiationSession }> {
    const session = await this.resolveSession(sessionToken, sessionId);

    if (NegotiationStateMachine.isTerminal(session.status)) {
      throw new SessionAlreadyClosedError(`Negotiation is already ${session.status.toLowerCase()}`);
    }

    NegotiationStateMachine.assertTransition(session.status, "REJECTED");
    await NegoZaarRepository.updateSessionStatus(session.id, "REJECTED");

    const rejectionMsgText = reason || "The offer was declined. Thank you for your time.";
    await NegoZaarRepository.addMessage({
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "SYSTEM",
      messageText: rejectionMsgText,
      roundNumber: session.attemptNumber || session.currentRound,
      attemptNumber: session.attemptNumber || session.currentRound,
      createdAt: new Date().toISOString(),
    });

    await NegoZaarRepository.recordAnalyticsEvent({
      id: crypto.randomUUID(),
      storeId: session.storeId,
      sessionId: session.id,
      eventType: "OFFER_REJECTED",
      properties: { reason: rejectionMsgText },
      occurredAt: new Date().toISOString(),
    });

    const updatedSession = (await NegoZaarRepository.getSessionById(session.id))!;
    return { success: true, session: updatedSession };
  }

  /**
   * Terminates or ends an active negotiation session
   */
  public static async endNegotiation(
    sessionId: string,
    reason?: string,
    sessionToken?: string
  ): Promise<{ success: boolean; session: NegotiationSession }> {
    const session = await this.resolveSession(sessionToken, sessionId);

    if (NegotiationStateMachine.isTerminal(session.status)) {
      return { success: true, session };
    }

    NegotiationStateMachine.assertTransition(session.status, "TERMINATED");
    await NegoZaarRepository.updateSessionStatus(session.id, "TERMINATED");

    const endMsgText = reason || "Negotiation session was ended.";
    await NegoZaarRepository.addMessage({
      id: crypto.randomUUID(),
      sessionId: session.id,
      senderRole: "SYSTEM",
      messageText: endMsgText,
      roundNumber: session.attemptNumber || session.currentRound,
      attemptNumber: session.attemptNumber || session.currentRound,
      createdAt: new Date().toISOString(),
    });

    const updatedSession = (await NegoZaarRepository.getSessionById(session.id))!;
    return { success: true, session: updatedSession };
  }

  /**
   * Finalizes the deal and generates a store-native discount coupon
   */
  public static async claimDeal(sessionToken: string): Promise<DealAcceptanceResponse> {
    const payload = SessionTokenService.verifyToken(sessionToken);
    return this.acceptFinalOffer(payload.sessionId, sessionToken);
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
      currentRound: session.attemptNumber || session.currentRound,
      maxRounds: session.maxAttempts || session.maxRounds,
      originalPrice: session.originalPrice,
      currentOffer: session.currentOffer || session.finalAgreedPrice,
      currency: session.currency,
      product: {
        title: product?.title || "Product",
        imageUrl: product?.imageUrl,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        messageText: m.messageText,
        roundNumber: m.attemptNumber || m.roundNumber,
        createdAt: m.createdAt,
      })),
    };
  }
}
