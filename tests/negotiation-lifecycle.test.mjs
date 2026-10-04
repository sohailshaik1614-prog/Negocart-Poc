import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NegotiationSessionManager } from "../src/modules/negotiation/session-manager.ts";
import { NegoZaarRepository } from "../src/database/repository.ts";

beforeEach(() => {
  NegoZaarRepository.resetForTesting();
});

const DEFAULT_STORE_KEY = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
const DEFAULT_PRODUCT_ID = "e0000000-0000-0000-0000-000000000001";
const DEFAULT_MERCHANT_ID = "a0000000-0000-0000-0000-000000000001";
const DEFAULT_STORE_ID = "d0000000-0000-0000-0000-000000000001";

test("Negotiation Lifecycle: Starts session with complete session model and greeting message", async () => {
  const result = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
    cartReference: "cart_ref_98765",
  });

  assert.ok(result.sessionToken);
  const session = result.session;

  assert.ok(session.id);
  assert.equal(session.merchantId, DEFAULT_MERCHANT_ID);
  assert.equal(session.storeId, DEFAULT_STORE_ID);
  assert.equal(session.productId, DEFAULT_PRODUCT_ID);
  assert.equal(session.cartReference, "cart_ref_98765");
  assert.equal(session.originalPrice, 2000);
  assert.equal(session.attemptNumber, 0);
  assert.equal(session.maxAttempts, 3);
  assert.equal(session.status, "ACTIVE");
  assert.ok(session.createdAt);
  assert.ok(session.updatedAt);
  assert.ok(session.expiresAt);

  // Check initial message stored
  const messages = await NegoZaarRepository.getSessionMessages(session.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].senderRole, "AI_AGENT");
  assert.equal(messages[0].attemptNumber, 0);
  assert.ok(messages[0].messageText.includes("2000"));
});

test("Negotiation Lifecycle: Progressive customer offers and counteroffers match benchmark trajectory", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  const sessionToken = start.sessionToken;
  const sessionId = start.session.id;

  // Turn 1: Customer offers ₹1,400
  const turn1 = await NegotiationSessionManager.submitCustomerOffer({
    sessionToken,
    proposedAmount: 1400,
    message: "Can you give it for ₹1,400?",
  });

  assert.equal(turn1.dealClosed, false);
  assert.equal(turn1.session.attemptNumber, 1);
  assert.equal(turn1.session.status, "COUNTERED");
  assert.equal(turn1.session.currentOffer, turn1.counteroffer?.counterPrice);
  assert.ok(turn1.counteroffer?.counterPrice >= 1700 && turn1.counteroffer?.counterPrice <= 1900);

  // Verify stored messages for Turn 1
  const messages1 = await NegoZaarRepository.getSessionMessages(sessionId);
  assert.equal(messages1.length, 3); // initial + customer turn1 + ai turn1
  const custMsg1 = messages1[1];
  assert.equal(custMsg1.senderRole, "CUSTOMER");
  assert.equal(custMsg1.attemptNumber, 1);
  assert.equal(custMsg1.associatedOffer, 1400);

  const aiMsg1 = messages1[2];
  assert.equal(aiMsg1.senderRole, "AI_AGENT");
  assert.equal(aiMsg1.attemptNumber, 1);
  assert.equal(aiMsg1.associatedOffer, turn1.counteroffer?.counterPrice);

  // Turn 2: Customer offers ₹1,550
  const turn2 = await NegotiationSessionManager.submitCustomerOffer({
    sessionToken,
    proposedAmount: 1550,
    message: "How about ₹1,550?",
  });

  assert.equal(turn2.dealClosed, false);
  assert.equal(turn2.session.attemptNumber, 2);
  assert.ok(turn2.counteroffer?.counterPrice < turn1.counteroffer?.counterPrice);
  assert.ok(turn2.counteroffer?.counterPrice >= 1600);

  // Turn 3: Customer offers ₹1,600 (Final Round)
  const turn3 = await NegotiationSessionManager.submitCustomerOffer({
    sessionToken,
    proposedAmount: 1600,
    message: "₹1,600?",
  });

  assert.equal(turn3.session.attemptNumber, 3);
  assert.equal(turn3.counteroffer?.isFinalOffer, true);
  assert.ok(turn3.counteroffer?.counterPrice >= 1500 && turn3.counteroffer?.counterPrice <= 1650);
});

test("Negotiation Lifecycle: Auto-accepts when customer offer matches autoAcceptPrice threshold", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  // Seed rule has autoAcceptPrice = ₹1,850. Customer offers ₹1,900
  const result = await NegotiationSessionManager.submitCustomerOffer({
    sessionToken: start.sessionToken,
    proposedAmount: 1900,
    message: "I can pay ₹1,900 right now.",
  });

  assert.equal(result.dealClosed, true);
  assert.equal(result.session.status, "ACCEPTED");
  assert.equal(result.session.finalAgreedPrice, 1900);
  assert.equal(result.session.currentOffer, 1900);
});

test("Negotiation Lifecycle: Accepting final offer transitions to ACCEPTED and issues coupon code", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  await NegotiationSessionManager.submitCustomerOffer({
    sessionToken: start.sessionToken,
    proposedAmount: 1600,
  });

  const claim = await NegotiationSessionManager.acceptFinalOffer(start.session.id, start.sessionToken);

  assert.equal(claim.success, true);
  assert.ok(claim.discountCode.startsWith("NEGO-"));
  assert.ok(claim.agreedPrice >= 1500); // Guardrail ensured: never below floor
  assert.ok(claim.expiresAt);

  const closedSession = await NegoZaarRepository.getSessionById(start.session.id);
  assert.equal(closedSession?.status, "ACCEPTED");
  assert.ok(closedSession?.closedAt);
});

test("Negotiation Lifecycle: Rejecting offer marks session as REJECTED", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  const res = await NegotiationSessionManager.rejectOffer(start.session.id, "Customer rejected final offer");
  assert.equal(res.success, true);
  assert.equal(res.session.status, "REJECTED");
});

test("Negotiation Lifecycle: Ending negotiation marks session as TERMINATED", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  const res = await NegotiationSessionManager.endNegotiation(start.session.id, "Customer closed browser");
  assert.equal(res.success, true);
  assert.equal(res.session.status, "TERMINATED");
});
