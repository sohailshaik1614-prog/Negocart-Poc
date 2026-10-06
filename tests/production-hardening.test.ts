import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/modules/security/rate-limiter";
import { IdempotencyManager } from "../src/modules/reliability/idempotency";
import { withRetry } from "../src/modules/reliability/retry";
import { Logger } from "../src/modules/monitoring/logger";
import { AICostTracker } from "../src/modules/ai/cost-tracker";
import { AICache } from "../src/modules/ai/cache";
import { ResilientAIService } from "../src/modules/ai/resilient-ai-service";
import { BillingService } from "../src/modules/billing/billing-service";
import { TenantContextManager } from "../src/modules/tenancy/tenant-context";
import { NegotiationSessionManager } from "../src/modules/negotiation/session-manager";
import { NegoZaarRepository } from "../src/database/repository";
import { PlanQuotaExceededError, TenantAccessDeniedError } from "../src/core/errors/domain-errors";
import { AIDecision, AIPromptContext, INegotiationAIService } from "../src/core/types/ai.types";
import { AuthenticatedContext } from "../src/modules/auth/auth-service";

test("RateLimiter: Sliding window rate limiting enforces quota threshold", () => {
  const ip = "client-ip-" + Date.now();
  const maxReqs = 3;
  const windowSecs = 10;

  // 1st request - allowed
  const r1 = RateLimiter.check(ip, maxReqs, windowSecs);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  // 2nd request - allowed
  const r2 = RateLimiter.check(ip, maxReqs, windowSecs);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  // 3rd request - allowed
  const r3 = RateLimiter.check(ip, maxReqs, windowSecs);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th request - blocked
  const r4 = RateLimiter.check(ip, maxReqs, windowSecs);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.resetInSeconds > 0);
});

test("IdempotencyManager: Webhook event deduplication prevents duplicate processing", async () => {
  IdempotencyManager.resetForTesting();
  const webhookEventId = "evt_shopify_order_created_98765";

  // Check if processed before
  const isFirstCheck = await IdempotencyManager.isProcessed(webhookEventId);
  assert.equal(isFirstCheck, false);

  // Mark as processed
  await IdempotencyManager.markProcessed(webhookEventId, 3600);

  // Second check should detect processed event
  const isSecondCheck = await IdempotencyManager.isProcessed(webhookEventId);
  assert.equal(isSecondCheck, true);

  // Unprocessed event key returns false
  const unrelatedCheck = await IdempotencyManager.isProcessed("evt_other_event_123");
  assert.equal(unrelatedCheck, false);
});

test("Reliability withRetry: Executes with backoff and recovers from transient errors", async () => {
  let callCount = 0;

  const flakyApiCall = async () => {
    callCount++;
    if (callCount < 3) {
      throw new Error("Temporary network glitch (503 Service Unavailable)");
    }
    return { status: "success", data: "synced" };
  };

  const result = await withRetry(flakyApiCall, {
    maxRetries: 4,
    initialDelayMs: 10,
    maxDelayMs: 50,
  });

  assert.equal(result.status, "success");
  assert.equal(callCount, 3);
});

test("Reliability withRetry: Throws after maxRetries exceeded", async () => {
  let callCount = 0;
  const failingCall = async () => {
    callCount++;
    throw new Error("Persistent database timeout");
  };

  await assert.rejects(
    async () => {
      await withRetry(failingCall, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 30,
      });
    },
    /Persistent database timeout/
  );

  assert.equal(callCount, 3); // initial + 2 retries
});

test("Logger: Redacts sensitive secrets and merchant floor prices", () => {
  const capturedLogs: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => capturedLogs.push(msg);

  try {
    Logger.info("Store negotiation initialized", {
      storeId: "store_safe_123",
      password: "SuperSecretPassword123!",
      minAcceptablePrice: 1500,
      floorPrice: 1450,
      secret: "shpss_secret_vault_token",
      publicPrice: 2000,
    });

    assert.equal(capturedLogs.length, 1);
    const parsed = JSON.parse(capturedLogs[0]);

    assert.equal(parsed.storeId, "store_safe_123");
    assert.equal(parsed.publicPrice, 2000);
    assert.equal(parsed.password, "[REDACTED]");
    assert.equal(parsed.minAcceptablePrice, "[REDACTED]");
    assert.equal(parsed.floorPrice, "[REDACTED]");
    assert.equal(parsed.secret, "[REDACTED]");
  } finally {
    console.log = originalLog;
  }
});

test("AI Cost Tracker: Accurately records token usage and computes USD rate cards", () => {
  AICostTracker.resetForTesting();
  const storeId = "store_cost_audit_01";

  // Record 1: Gemini Flash completion (200 input, 50 output)
  const r1 = AICostTracker.trackUsage({
    sessionId: "sess_cost_01",
    storeId,
    provider: "gemini",
    promptTokens: 1000,
    completionTokens: 500,
  });

  assert.equal(r1.totalTokens, 1500);
  assert.ok(r1.estimatedCostUsd > 0);

  // Record 2: OpenAI completion (1000 input, 200 output)
  AICostTracker.trackUsage({
    sessionId: "sess_cost_01",
    storeId,
    provider: "openai",
    promptTokens: 1000,
    completionTokens: 200,
  });

  const sessionSummary = AICostTracker.getSessionUsage("sess_cost_01");
  assert.equal(sessionSummary.callsCount, 2);
  assert.equal(sessionSummary.totalTokens, 2700);

  const storeSummary = AICostTracker.getStoreUsageSummary(storeId);
  assert.equal(storeSummary.totalCalls, 2);
  assert.equal(storeSummary.totalTokens, 2700);
});

test("AI Cache: Deterministic SHA-256 caching saves identical inference rounds", () => {
  AICache.clear();

  const context: AIPromptContext = {
    productTitle: "Noise Cancelling Headphones",
    originalPrice: 2000,
    currency: "INR",
    currentRound: 1,
    maxRounds: 3,
    customerOffer: 1500,
    targetSuggestedCounter: 1750,
    minAllowedFloor: 1200,
    strategy: "MODERATE",
    history: [],
  };

  const decision: AIDecision = {
    action: "COUNTER",
    suggestedPrice: 1750,
    replyMessage: "I can offer ₹1,750 for this premium headset.",
    internalReasoning: "Standard first round concession",
  };

  // Initially empty cache
  assert.equal(AICache.get(context), null);

  // Store in cache
  AICache.set(context, decision);

  // Retrieve cached decision
  const hit = AICache.get(context);
  assert.ok(hit !== null);
  assert.equal(hit.suggestedPrice, 1750);
  assert.equal(hit.replyMessage, decision.replyMessage);
});

test("Resilient AI Service: Gracefully falls back to deterministic engine when primary times out or fails", async () => {
  AICache.clear();

  // Create an adversarial/failing primary provider
  const failingProvider: INegotiationAIService = {
    providerName: "failing-external-llm",
    generateNegotiationResponse: async () => {
      throw new Error("HTTP 504 Gateway Timeout from External AI Gateway");
    },
  };

  const resilientService = new ResilientAIService(failingProvider, 100);

  const context: AIPromptContext = {
    productTitle: "Mechanical Gaming Keyboard",
    originalPrice: 5000,
    currency: "INR",
    currentRound: 1,
    maxRounds: 3,
    customerOffer: 3500,
    targetSuggestedCounter: 4200,
    minAllowedFloor: 4000,
    strategy: "MODERATE",
    history: [],
  };

  // Resilient service should NOT throw, but fall back to deterministic engine
  const decision = await resilientService.generateNegotiationResponse(context);
  assert.ok(decision);
  assert.ok(decision.suggestedPrice >= 4000, "Fallback counter must be protected above merchant minimum");
  assert.ok(decision.replyMessage.length > 0);
});

test("SaaS Billing: Subscription plan limits and quota enforcement", async () => {
  BillingService.resetForTesting();
  const testMerchantId = "merch_quota_test_123";

  // New merchant gets Free Trial (50 negotiations limit)
  const sub = await BillingService.getMerchantSubscription(testMerchantId);
  assert.equal(sub.planId, "FREE_TRIAL");
  assert.equal(sub.monthlyNegotiationsUsed, 0);

  // Check quota - should be allowed
  const q1 = await BillingService.checkNegotiationQuota(testMerchantId);
  assert.equal(q1.allowed, true);
  assert.equal(q1.maxAllowed, 50);

  // Increment usage to cap
  sub.monthlyNegotiationsUsed = 50;

  // Quota check should now be disallowed
  const q2 = await BillingService.checkNegotiationQuota(testMerchantId);
  assert.equal(q2.allowed, false);
  assert.ok(q2.reason?.includes("Monthly negotiation limit"));

  // Stripe upgrade webhook
  await BillingService.handleStripeWebhook({
    id: "evt_stripe_test_upg",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_stripe_growth_123",
        customer: "cus_stripe_123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
        metadata: { merchantId: testMerchantId },
      },
    },
  });

  // Switch plan to GROWTH
  sub.planId = "GROWTH"; // Growth limit is 1500
  const q3 = await BillingService.checkNegotiationQuota(testMerchantId);
  assert.equal(q3.allowed, true);
  assert.equal(q3.maxAllowed, 1500);

  // Payment succeeded resets usage count
  await BillingService.handleStripeWebhook({
    id: "evt_stripe_test_inv",
    type: "invoice.payment_succeeded",
    data: {
      object: {
        id: "in_stripe_inv_123",
        metadata: { merchantId: testMerchantId },
      },
    },
  });

  const updatedSub = await BillingService.getMerchantSubscription(testMerchantId);
  assert.equal(updatedSub.monthlyNegotiationsUsed, 0);
});

test("SaaS Billing: NegotiationSessionManager blocks session initialization when quota is exceeded", async () => {
  BillingService.resetForTesting();
  const quotaMerchantId = "merch_capped_merchant_099";

  const sub = await BillingService.getMerchantSubscription(quotaMerchantId);
  sub.monthlyNegotiationsUsed = 50; // Cap reached on Free Trial

  // Setup store and product owned by this capped merchant
  const store = await NegoZaarRepository.createStore({
    merchantId: quotaMerchantId,
    storeName: "Capped Fashion Store",
    platform: "CUSTOM",
    platformStoreId: "custom_capped_store",
    currency: "INR",
  });

  const product = await NegoZaarRepository.createProduct({
    storeId: store.id,
    externalProductId: "prod_cap_123",
    title: "Designer Jacket",
    originalPrice: 10000,
    minAcceptablePrice: 7500,
    autoAcceptPrice: 9000,
    maxNegotiationRounds: 3,
    currency: "INR",
  });

  // Session start should fail with PlanQuotaExceededError
  await assert.rejects(
    async () => {
      await NegotiationSessionManager.startSession({
        publicStoreKey: store.publicStoreKey,
        productId: product.id,
        customerEmail: "blocked_shopper@example.com",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof PlanQuotaExceededError);
      assert.equal((err as PlanQuotaExceededError).statusCode, 402);
      return true;
    }
  );
});

test("Multi-Tenancy Isolation: TenantContextManager strictly forbids cross-tenant access", async () => {
  const merchantA_Auth: AuthenticatedContext = {
    userId: "user_a",
    merchantId: "merch_company_alpha",
    role: "OWNER",
    email: "alpha@example.com",
  };

  const merchantB_Auth: AuthenticatedContext = {
    userId: "user_b",
    merchantId: "merch_company_beta",
    role: "OWNER",
    email: "beta@example.com",
  };

  // Create store owned by Alpha
  const alphaStore = await NegoZaarRepository.createStore({
    merchantId: merchantA_Auth.merchantId,
    storeName: "Alpha Boutique",
    platform: "SHOPIFY",
    platformStoreId: "alpha-boutique.myshopify.com",
    currency: "USD",
  });

  const alphaProduct = await NegoZaarRepository.createProduct({
    storeId: alphaStore.id,
    externalProductId: "ext_alpha_prod",
    title: "Alpha Watch",
    originalPrice: 500,
    minAcceptablePrice: 350,
    currency: "USD",
  });

  // 1. Alpha accessing Alpha store -> succeeds
  const storeAccess = await TenantContextManager.validateStoreAccess(merchantA_Auth, alphaStore.id);
  assert.equal(storeAccess.id, alphaStore.id);

  // 2. Alpha accessing Alpha product -> succeeds
  const prodAccess = await TenantContextManager.validateProductAccess(merchantA_Auth, alphaProduct.id);
  assert.equal(prodAccess.id, alphaProduct.id);

  // 3. Beta attempting to access Alpha store -> denied
  await assert.rejects(
    async () => {
      await TenantContextManager.validateStoreAccess(merchantB_Auth, alphaStore.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof TenantAccessDeniedError);
      return true;
    }
  );

  // 4. Beta attempting to access Alpha product -> denied
  await assert.rejects(
    async () => {
      await TenantContextManager.validateProductAccess(merchantB_Auth, alphaProduct.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof TenantAccessDeniedError);
      return true;
    }
  );
});
