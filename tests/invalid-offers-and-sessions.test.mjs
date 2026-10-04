import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NegotiationSessionManager } from "../src/modules/negotiation/session-manager.ts";
import { NegoZaarRepository } from "../src/database/repository.ts";
import {
  NegotiationRoundsExceededError,
  SessionAlreadyClosedError,
  SessionExpiredError,
  ProductNotEligibleError,
  StoreNotFoundError,
  InvalidSessionTokenError,
} from "../src/core/errors/domain-errors.ts";

beforeEach(() => {
  NegoZaarRepository.resetForTesting();
});

const DEFAULT_STORE_KEY = "pub_live_apex_9a8b7c6d5e4f3a2b1c";
const DEFAULT_PRODUCT_ID = "e0000000-0000-0000-0000-000000000001";

test("Invalid Offers: Negative or invalid offer amounts throw an error", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: start.sessionToken,
        proposedAmount: -500,
      }),
    /positive finite number/
  );

  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: start.sessionToken,
        proposedAmount: 0,
      }),
    /positive finite number/
  );
});

test("Invalid Offers: Offer below merchant floor is intercepted and marked REJECTED in offer record", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  // Floor is ₹1,500. Customer proposes ₹800.
  const result = await NegotiationSessionManager.submitCustomerOffer({
    sessionToken: start.sessionToken,
    proposedAmount: 800,
  });

  const offers = await NegoZaarRepository.getSessionOffers(start.session.id);
  const customerOffer = offers.find((o) => o.proposedBy === "CUSTOMER");
  assert.ok(customerOffer);
  assert.equal(customerOffer.guardrailStatus, "REJECTED");
  assert.equal(customerOffer.guardrailNotes, "Below merchant minimum acceptable floor price");

  // Verify counteroffer never falls below floor
  assert.ok(result.counteroffer?.counterPrice >= 1500);
});

test("Invalid Offers: Exceeding maximum allowed attempts throws NegotiationRoundsExceededError", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  // Max attempts is 3
  await NegotiationSessionManager.submitCustomerOffer({ sessionToken: start.sessionToken, proposedAmount: 1400 });
  await NegotiationSessionManager.submitCustomerOffer({ sessionToken: start.sessionToken, proposedAmount: 1400 });
  await NegotiationSessionManager.submitCustomerOffer({ sessionToken: start.sessionToken, proposedAmount: 1400 });

  // 4th attempt must fail
  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: start.sessionToken,
        proposedAmount: 1400,
      }),
    NegotiationRoundsExceededError
  );
});

test("Invalid Sessions: Submitting offer to expired session throws SessionExpiredError", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  // Manually backdate expiration to simulate expired session
  const session = await NegoZaarRepository.getSessionById(start.session.id);
  session.expiresAt = new Date(Date.now() - 3600 * 1000).toISOString();

  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: start.sessionToken,
        proposedAmount: 1600,
      }),
    SessionExpiredError
  );
});

test("Invalid Sessions: Submitting offer to already closed session throws SessionAlreadyClosedError", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  // Close session via acceptance
  await NegotiationSessionManager.acceptFinalOffer(start.session.id, start.sessionToken);

  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: start.sessionToken,
        proposedAmount: 1650,
      }),
    SessionAlreadyClosedError
  );
});

test("Invalid Sessions: Starting session with invalid store key throws StoreNotFoundError", async () => {
  await assert.rejects(
    async () =>
      NegotiationSessionManager.startSession({
        publicStoreKey: "invalid_store_key_12345",
        productId: DEFAULT_PRODUCT_ID,
      }),
    StoreNotFoundError
  );
});

test("Invalid Sessions: Starting session on disabled negotiation product throws ProductNotEligibleError", async () => {
  // Disable negotiation for product
  const rule = await NegoZaarRepository.getProductRule("d0000000-0000-0000-0000-000000000001", DEFAULT_PRODUCT_ID);
  rule.isNegotiationEnabled = false;

  await assert.rejects(
    async () =>
      NegotiationSessionManager.startSession({
        publicStoreKey: DEFAULT_STORE_KEY,
        productId: DEFAULT_PRODUCT_ID,
      }),
    ProductNotEligibleError
  );
});

test("Invalid Sessions: Tampered session token is rejected with InvalidSessionTokenError", async () => {
  const start = await NegotiationSessionManager.startSession({
    publicStoreKey: DEFAULT_STORE_KEY,
    productId: DEFAULT_PRODUCT_ID,
  });

  const parts = start.sessionToken.split(".");
  const tampered = `${parts[0]}.tamperedbody.${parts[2]}`;

  await assert.rejects(
    async () =>
      NegotiationSessionManager.submitCustomerOffer({
        sessionToken: tampered,
        proposedAmount: 1600,
      }),
    InvalidSessionTokenError
  );
});
