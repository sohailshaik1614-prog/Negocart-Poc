import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NegoZaarRepository } from "@/database/repository";
import { SessionManager } from "@/modules/negotiation/session-manager";
import { AnalyticsService } from "@/modules/analytics/analytics-service";
import { IntelligenceService } from "@/modules/intelligence/intelligence-service";

test("Analytics & Event Tracking: Complete Negotiation Lifecycle Emits Real Events", async () => {
  NegoZaarRepository.resetForTesting();

  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const storeId = "d0000000-0000-0000-0000-000000000001";
  const productId = "e0000000-0000-0000-0000-000000000001"; // ₹2,000 retail, ₹1,500 floor

  // 1. Session Started
  const startResult = await SessionManager.startSession({
    publicStoreKey: storeKey,
    productId,
    customerEmail: "cust_shopper_01@example.com",
  });
  const sessionToken = startResult.sessionToken;
  const sessionId = startResult.session.id;

  // 2. Customer Offer Submitted (₹1,400 - below floor)
  await SessionManager.submitCustomerOffer({
    sessionId,
    sessionToken,
    proposedAmount: 1400,
    message: "Can you do ₹1,400?",
  });

  // 3. Customer Offer Submitted (₹1,600 - within acceptable bounds)
  await SessionManager.submitCustomerOffer({
    sessionId,
    sessionToken,
    proposedAmount: 1600,
    message: "How about ₹1,600?",
  });

  // 4. Accept Final Deal
  const acceptResult = await SessionManager.acceptFinalOffer(sessionId, sessionToken);
  assert.equal(acceptResult.success, true);
  assert.ok(acceptResult.discountCode);

  // 5. Verify all real database analytics events were recorded
  const events = await NegoZaarRepository.getAnalyticsEvents({ storeId });

  const eventTypes = events.map((e) => e.eventType);
  assert.ok(eventTypes.includes("SESSION_STARTED"), "SESSION_STARTED must be recorded");
  assert.ok(eventTypes.includes("OFFER_PROPOSED"), "OFFER_PROPOSED must be recorded");
  assert.ok(eventTypes.includes("COUNTER_OFFER_MADE"), "COUNTER_OFFER_MADE must be recorded");
  assert.ok(eventTypes.includes("OFFER_ACCEPTED"), "OFFER_ACCEPTED must be recorded");
  assert.ok(eventTypes.includes("COUPON_GENERATED"), "COUPON_GENERATED must be recorded");
  assert.ok(eventTypes.includes("SESSION_COMPLETED"), "SESSION_COMPLETED must be recorded");

  // Verify event payload accuracy
  const startedEvent = events.find((e) => e.eventType === "SESSION_STARTED");
  assert.equal(startedEvent?.properties.originalPrice, 2000);

  const offerEvents = events.filter((e) => e.eventType === "OFFER_PROPOSED");
  assert.equal(offerEvents.length, 2);
  assert.equal(offerEvents[0].properties.amount, 1400);
  assert.equal(offerEvents[0].properties.isBelowFloor, true);
  assert.equal(offerEvents[1].properties.amount, 1600);
  assert.equal(offerEvents[1].properties.isBelowFloor, false);
});

test("Analytics Service: Sufficiency Guard Prevents Premature Revenue Claims", async () => {
  NegoZaarRepository.resetForTesting();
  const storeId = "d0000000-0000-0000-0000-000000000001";
  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = "e0000000-0000-0000-0000-000000000001";

  // Run only 2 completed negotiations (less than the minimum 5 required for statistical claim)
  for (let i = 0; i < 2; i++) {
    const s = await SessionManager.startSession({
      publicStoreKey: storeKey,
      productId,
      customerEmail: `cust_${i}@example.com`,
    });
    await SessionManager.submitCustomerOffer({
      sessionId: s.session.id,
      sessionToken: s.sessionToken,
      proposedAmount: 1850,
      message: "Offer",
    });
  }

  const analytics = await AnalyticsService.getStoreAnalytics({ storeId });

  // Sufficiency guard must flag data as INSUFFICIENT and block premature revenue uplift claims
  assert.equal(analytics.revenueRecovery.dataConfidence, "INSUFFICIENT");
  assert.equal(analytics.revenueRecovery.sufficientDataForClaim, false);
  assert.match(
    analytics.revenueRecovery.confidenceReason,
    /minimum of 5 completed negotiations are required/
  );
});

test("Analytics Service: Multi-Session Aggregation & Metric Accuracy", async () => {
  NegoZaarRepository.resetForTesting();
  const storeId = "d0000000-0000-0000-0000-000000000001";
  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = "e0000000-0000-0000-0000-000000000001"; // ₹2,000 retail, ₹1,500 floor

  // Generate 6 completed negotiations to satisfy sufficiency threshold
  // 4 Accepted at ₹1,800, 1 Rejected, 1 Abandoned
  for (let i = 0; i < 4; i++) {
    const s = await SessionManager.startSession({
      publicStoreKey: storeKey,
      productId,
      customerEmail: `accepted_cust_${i}@example.com`,
    });
    await SessionManager.submitCustomerOffer({
      sessionId: s.session.id,
      sessionToken: s.sessionToken,
      proposedAmount: 1750,
      message: "Offer",
    });
    await SessionManager.acceptFinalOffer(s.session.id, s.sessionToken);
  }

  // 1 Rejected
  const rej = await SessionManager.startSession({
    publicStoreKey: storeKey,
    productId,
    customerEmail: "rejected_cust@example.com",
  });
  await SessionManager.submitCustomerOffer({
    sessionId: rej.session.id,
    sessionToken: rej.sessionToken,
    proposedAmount: 1200,
    message: "Low",
  });
  await SessionManager.rejectOffer(rej.session.id, "Price too high", rej.sessionToken);

  // 1 Terminated / Abandoned
  const term = await SessionManager.startSession({
    publicStoreKey: storeKey,
    productId,
    customerEmail: "abandoned_cust@example.com",
  });
  await SessionManager.endNegotiation(term.session.id, "Walk away", term.sessionToken);

  const analytics = await AnalyticsService.getStoreAnalytics({ storeId });

  // 1. Overview Metrics
  assert.equal(analytics.overview.negotiationsStarted, 6);
  assert.equal(analytics.overview.negotiationsCompleted, 6);
  assert.equal(analytics.overview.negotiationsAbandoned, 1);
  assert.equal(analytics.overview.acceptedOffersCount, 4);
  assert.equal(analytics.overview.rejectedOffersCount, 1);

  // Conversion rate = 4/6 = 66.7%
  assert.equal(analytics.overview.conversionRate, 66.7);
  // Success rate = 4/6 = 66.7%
  assert.equal(analytics.overview.negotiationSuccessRate, 66.7);

  // Revenue generated / recovered = 4 * 1800 (counter agreed)
  assert.ok(analytics.overview.totalRevenueRecovered > 0);
  assert.equal(analytics.overview.averageOrderValue, analytics.overview.totalRevenueRecovered / 4);

  // Margin preserved: agreed - floor (1,500)
  assert.ok(analytics.overview.totalMarginProtected > 0);

  // 2. Sufficiency Check passed (6 sessions >= 5)
  assert.equal(analytics.revenueRecovery.sufficientDataForClaim, true);
  assert.equal(analytics.revenueRecovery.dataConfidence, "MODERATE");

  // 3. Discount Analysis Brackets
  assert.ok(analytics.discountAnalysis.brackets.length === 5);
  const totalDealsInBrackets = analytics.discountAnalysis.brackets.reduce(
    (acc, b) => acc + b.dealCount,
    0
  );
  assert.equal(totalDealsInBrackets, 4);

  // 4. Product-Level Performance & Floor Utilization
  assert.ok(analytics.productPerformance.length >= 1);
  const prodPerf = analytics.productPerformance.find((p) => p.productId === productId);
  assert.ok(prodPerf);
  assert.equal(prodPerf.totalSessions, 6);
  assert.equal(prodPerf.acceptedDeals, 4);
  assert.equal(prodPerf.conversionRate, 66.7);
  assert.ok(prodPerf.floorUtilizationPercentage > 0 && prodPerf.floorUtilizationPercentage < 100);

  // 5. Time-Based Trends
  assert.ok(analytics.timeBasedTrends.length > 0);
  const todayKey = new Date().toISOString().split("T")[0];
  const todayBucket = analytics.timeBasedTrends.find((t) => t.date === todayKey);
  assert.ok(todayBucket);
  assert.equal(todayBucket.started, 6);
  assert.equal(todayBucket.accepted, 4);
});

test("Modular Intelligence Layer: Customer Behavior Signals & Strategy Optimization", async () => {
  NegoZaarRepository.resetForTesting();
  const storeId = "d0000000-0000-0000-0000-000000000001";
  const storeKey = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
  const productId = "e0000000-0000-0000-0000-000000000001";

  // Simulate 4 shoppers submitting aggressive initial offers (₹1,300 vs ₹2,000 retail = 35% lowball)
  for (let i = 0; i < 4; i++) {
    const s = await SessionManager.startSession({
      publicStoreKey: storeKey,
      productId,
      customerEmail: `shopper_${i}@example.com`,
    });
    await SessionManager.submitCustomerOffer({
      sessionId: s.session.id,
      sessionToken: s.sessionToken,
      proposedAmount: 1300,
      message: "Aggressive lowball",
    });
    await SessionManager.rejectOffer(s.session.id, "Too low", s.sessionToken);
  }

  const analytics = await AnalyticsService.getStoreAnalytics({ storeId });
  const intel = analytics.intelligence;

  // Behavior signals
  assert.ok(intel.behaviorSignals.averageOfferAggressiveness < 0.75); // 1300/2000 = 0.65
  assert.equal(intel.behaviorSignals.priceSensitivityScore, "HIGH");

  // Strategy Insights: since conversion is 0% (< 40%), engine must recommend FRIENDLY strategy
  assert.ok(intel.strategyInsights.length > 0);
  assert.equal(intel.strategyInsights[0].recommendedStrategy, "FRIENDLY");
  assert.ok(intel.strategyInsights[0].confidenceScore > 0.7);

  // Product Recommendations: since conversion is 0% (< 35%), engine must recommend EXPAND_MARGIN
  const prodRec = intel.productRecommendations.find((r) => r.productId === productId);
  assert.ok(prodRec);
  assert.equal(prodRec.type, "EXPAND_MARGIN");
  assert.equal(prodRec.severity, "ACTION_REQUIRED");
});
