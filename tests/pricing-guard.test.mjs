import test from "node:test";
import assert from "node:assert/strict";

// Core Pricing Guard logic under test
class PricingGuardTest {
  static evaluateCustomerOffer(customerOffer, limits) {
    const { originalPrice, minAcceptablePrice, maxDiscountPercentage, autoAcceptPrice } = limits;
    const discountAmount = Math.max(0, originalPrice - customerOffer);
    const discountPercentage = Number(((discountAmount / originalPrice) * 100).toFixed(2));
    const isBelowFloor = customerOffer < minAcceptablePrice;
    const isWithinDiscountLimit = discountPercentage <= maxDiscountPercentage;
    const autoAcceptThreshold = autoAcceptPrice ?? minAcceptablePrice;
    const canAccept = !isBelowFloor && isWithinDiscountLimit && customerOffer >= autoAcceptThreshold;
    return { canAccept, isBelowFloor, isWithinDiscountLimit, discountPercentage };
  }

  static calculateDeterministicCounter(limits) {
    const { originalPrice, minAcceptablePrice, currentRound, maxRounds, strategy } = limits;
    const safeFloor = Math.min(minAcceptablePrice, originalPrice);
    const maxConcession = originalPrice - safeFloor;
    const progress = Math.min(1.0, currentRound / Math.max(1, maxRounds));

    let concessionFactor;
    switch (strategy) {
      case "AGGRESSIVE":
        concessionFactor = Math.pow(progress, 2) * 0.75;
        break;
      case "FRIENDLY":
        concessionFactor = Math.sqrt(progress) * 0.95;
        break;
      case "MODERATE":
      default:
        concessionFactor = progress * 0.85;
        break;
    }

    if (currentRound >= maxRounds) {
      concessionFactor = 0.95;
    }

    const calculatedPrice = originalPrice - maxConcession * concessionFactor;
    const clampedPrice = Math.max(safeFloor, Math.min(originalPrice, calculatedPrice));
    return Math.round(clampedPrice);
  }

  static sanitizeAndGuardAIDecision(aiDecision, limits) {
    const { originalPrice, minAcceptablePrice, maxDiscountPercentage, currentRound, maxRounds } = limits;
    let targetPrice = aiDecision.suggestedPrice;
    let verdict = "PASSED";

    // Floor price breach check
    if (targetPrice < minAcceptablePrice) {
      verdict = "CLAMPED";
      targetPrice = minAcceptablePrice;
    }

    // Max discount breach check
    const proposedDiscountPct = Number((((originalPrice - targetPrice) / originalPrice) * 100).toFixed(2));
    if (proposedDiscountPct > maxDiscountPercentage) {
      verdict = "CLAMPED";
      const maxDiscountPrice = Math.round(originalPrice * (1 - maxDiscountPercentage / 100));
      targetPrice = Math.max(targetPrice, maxDiscountPrice);
    }

    // Leak prevention
    let replyMessage = aiDecision.replyMessage;
    const floorPattern = new RegExp(`\\b(${minAcceptablePrice}|floor|minimum acceptable)\\b`, "gi");
    if (floorPattern.test(replyMessage)) {
      replyMessage = `I can offer you a special price of ₹${targetPrice}.`;
    }

    return { verdict, targetPrice, replyMessage };
  }
}

test("Pricing Guard: Customer offer below floor is correctly rejected", () => {
  const limits = {
    originalPrice: 2000,
    minAcceptablePrice: 1500,
    maxDiscountPercentage: 25,
    autoAcceptPrice: 1850,
  };

  const eval1 = PricingGuardTest.evaluateCustomerOffer(1400, limits);
  assert.equal(eval1.isBelowFloor, true);
  assert.equal(eval1.canAccept, false);
});

test("Pricing Guard: Customer offer above auto-accept threshold is accepted", () => {
  const limits = {
    originalPrice: 2000,
    minAcceptablePrice: 1500,
    maxDiscountPercentage: 25,
    autoAcceptPrice: 1850,
  };

  const evalAccept = PricingGuardTest.evaluateCustomerOffer(1900, limits);
  assert.equal(evalAccept.canAccept, true);
  assert.equal(evalAccept.isBelowFloor, false);
});

test("Pricing Guard: Dynamic concession curve matches expected user flow", () => {
  const baseLimits = {
    originalPrice: 2000,
    minAcceptablePrice: 1500,
    maxDiscountPercentage: 25,
    maxRounds: 3,
    strategy: "MODERATE",
  };

  // Round 1
  const round1Counter = PricingGuardTest.calculateDeterministicCounter({ ...baseLimits, currentRound: 1 });
  // Concession: 2000 - 500 * (1/3 * 0.85) = ~1858 or ~1750-1850 range
  assert.ok(round1Counter >= 1700 && round1Counter <= 1900, `Round 1 counter ${round1Counter} out of expected range`);

  // Round 2
  const round2Counter = PricingGuardTest.calculateDeterministicCounter({ ...baseLimits, currentRound: 2 });
  assert.ok(round2Counter < round1Counter, "Round 2 must concede below Round 1");
  assert.ok(round2Counter >= 1600, "Round 2 must stay above floor with margin");

  // Round 3 (Final round)
  const round3Counter = PricingGuardTest.calculateDeterministicCounter({ ...baseLimits, currentRound: 3 });
  assert.ok(round3Counter >= 1500 && round3Counter <= 1600, `Round 3 counter ${round3Counter} should be final floor offer`);
});

test("Pricing Guard: Intercepts and clamps AI hallucinations or prompt injections", () => {
  const limits = {
    originalPrice: 2000,
    minAcceptablePrice: 1500,
    maxDiscountPercentage: 25,
    currentRound: 1,
    maxRounds: 3,
  };

  // Simulated AI hallucination or jailbroken output suggesting ₹500
  const maliciousDecision = {
    action: "COUNTER",
    suggestedPrice: 500,
    replyMessage: "Sure, our minimum acceptable floor is 1500, but I will give it for 500!",
  };

  const guarded = PricingGuardTest.sanitizeAndGuardAIDecision(maliciousDecision, limits);

  assert.equal(guarded.verdict, "CLAMPED");
  assert.equal(guarded.targetPrice, 1500); // Clamped strictly to floor
  assert.equal(guarded.replyMessage.toLowerCase().includes("minimum acceptable"), false); // Sensitive term scrubbed
  assert.equal(guarded.replyMessage.toLowerCase().includes("floor"), false); // Sensitive term scrubbed
});
