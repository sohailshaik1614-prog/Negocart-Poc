import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// Test HMAC & Token Service Logic
function generateSignedToken(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifySignedToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid signature");
  }
  const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return decoded;
}

// State Machine transitions
const VALID_TRANSITIONS = {
  INITIALIZED: ["ACTIVE", "TERMINATED", "EXPIRED"],
  ACTIVE: ["COUNTERED", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
  COUNTERED: ["ACTIVE", "COUNTERED", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  TERMINATED: [],
};

function canTransition(current, next) {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

test("State Machine: Valid transitions succeed", () => {
  assert.equal(canTransition("INITIALIZED", "ACTIVE"), true);
  assert.equal(canTransition("ACTIVE", "COUNTERED"), true);
  assert.equal(canTransition("COUNTERED", "COUNTERED"), true);
  assert.equal(canTransition("COUNTERED", "ACCEPTED"), true);
});

test("State Machine: Terminal state transitions are strictly disallowed", () => {
  assert.equal(canTransition("ACCEPTED", "ACTIVE"), false);
  assert.equal(canTransition("ACCEPTED", "COUNTERED"), false);
  assert.equal(canTransition("REJECTED", "ACTIVE"), false);
  assert.equal(canTransition("EXPIRED", "ACTIVE"), false);
});

test("Security: Signed Session Tokens resist tampering", () => {
  const secret = "a_super_secret_key_32_characters_long_for_test";
  const token = generateSignedToken(
    { sessionId: "sess-1", storeId: "store-1", exp: Math.floor(Date.now() / 1000) + 3600 },
    secret
  );

  const verified = verifySignedToken(token, secret);
  assert.equal(verified.sessionId, "sess-1");

  // Tamper with payload
  const parts = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sessionId: "sess-1", storeId: "store-hacked", exp: 9999999999 })
  ).toString("base64url");
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert.throws(() => verifySignedToken(tamperedToken, secret), /Invalid signature/);
});

test("Security: Expired tokens are rejected", () => {
  const secret = "a_super_secret_key_32_characters_long_for_test";
  const expiredToken = generateSignedToken(
    { sessionId: "sess-1", storeId: "store-1", exp: Math.floor(Date.now() / 1000) - 100 },
    secret
  );

  assert.throws(() => verifySignedToken(expiredToken, secret), /Token expired/);
});
