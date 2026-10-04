import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PasswordService } from "../src/modules/auth/password-service.ts";
import { MerchantTokenService } from "../src/modules/auth/merchant-token-service.ts";
import { AuthService } from "../src/modules/auth/auth-service.ts";
import { NegoZaarRepository } from "../src/database/repository.ts";

beforeEach(() => {
  NegoZaarRepository.resetForTesting();
});

test("PasswordService: Hashes and verifies password with random salt", () => {
  const password = "SuperSecretPassword123!";
  const hash = PasswordService.hashPassword(password);

  assert.ok(hash.includes(":"), "Hash must contain salt and digest separated by colon");
  assert.equal(PasswordService.verifyPassword(password, hash), true);
  assert.equal(PasswordService.verifyPassword("WrongPassword123!", hash), false);
  assert.equal(PasswordService.verifyPassword("", hash), false);
});

test("MerchantTokenService: Generates and verifies tamper-proof session tokens", () => {
  const payload = {
    userId: "user-123",
    merchantId: "merch-456",
    role: "OWNER",
    email: "owner@brand.com",
  };

  const token = MerchantTokenService.generateSessionToken(payload, 7);
  assert.ok(token && typeof token === "string");

  const verified = MerchantTokenService.verifySessionToken(token);
  assert.equal(verified.userId, "user-123");
  assert.equal(verified.merchantId, "merch-456");
  assert.equal(verified.role, "OWNER");
  assert.equal(verified.email, "owner@brand.com");

  // Tampering detection
  const parts = token.split(".");
  const tampered = `${parts[0]}.${parts[1]}tampered.${parts[2]}`;
  assert.throws(() => MerchantTokenService.verifySessionToken(tampered));
});

test("AuthService: Registers a new merchant organization, owner, and store", async () => {
  const regDTO = {
    email: "new_founder@brandfashion.test",
    password: "PasswordSecure123!",
    fullName: "Aryan Patel",
    merchantName: "Brand Fashion Pvt Ltd",
    storeName: "Brand Fashion Flagship",
    currency: "INR",
  };

  const result = await AuthService.registerMerchant(regDTO);

  assert.ok(result.sessionToken);
  assert.equal(result.user.email, "new_founder@brandfashion.test");
  assert.equal(result.user.role, "OWNER");
  assert.equal(result.merchant.name, "Brand Fashion Pvt Ltd");
  assert.ok(result.store?.id);
  assert.equal(result.store.storeName, "Brand Fashion Flagship");

  // Verify created in repository
  const userInDb = await NegoZaarRepository.getUserByEmail("new_founder@brandfashion.test");
  assert.ok(userInDb);
  assert.equal(userInDb.fullName, "Aryan Patel");
  assert.ok(userInDb.passwordHash);
});

test("AuthService: Rejects duplicate merchant email registration", async () => {
  const regDTO = {
    email: "duplicate@brand.test",
    password: "PasswordSecure123!",
    fullName: "Aryan Patel",
    merchantName: "Brand A",
  };

  await AuthService.registerMerchant(regDTO);

  await assert.rejects(
    async () => AuthService.registerMerchant(regDTO),
    (err) => {
      assert.equal(err.code, "USER_EXISTS");
      return true;
    }
  );
});

test("AuthService: Authenticates valid login credentials", async () => {
  // Use seeded merchant user: merchant@apexretail.test / Password123!
  const loginResult = await AuthService.login({
    email: "merchant@apexretail.test",
    password: "Password123!",
  });

  assert.ok(loginResult.sessionToken);
  assert.equal(loginResult.user.email, "merchant@apexretail.test");
  assert.equal(loginResult.merchant.name, "Apex Retail Brands");
});

test("AuthService: Rejects invalid password or non-existent email", async () => {
  await assert.rejects(
    async () =>
      AuthService.login({
        email: "merchant@apexretail.test",
        password: "WrongPassword999!",
      }),
    (err) => {
      assert.equal(err.code, "INVALID_CREDENTIALS");
      return true;
    }
  );

  await assert.rejects(
    async () =>
      AuthService.login({
        email: "nonexistent@user.com",
        password: "Password123!",
      }),
    (err) => {
      assert.equal(err.code, "INVALID_CREDENTIALS");
      return true;
    }
  );
});

test("AuthService: Resolves authenticated context from Bearer token", async () => {
  const token = MerchantTokenService.generateSessionToken({
    userId: "b0000000-0000-0000-0000-000000000001",
    merchantId: "a0000000-0000-0000-0000-000000000001",
    role: "OWNER",
    email: "merchant@apexretail.test",
  });

  const context = await AuthService.resolveAuthContext(`Bearer ${token}`);
  assert.equal(context.userId, "b0000000-0000-0000-0000-000000000001");
  assert.equal(context.merchantId, "a0000000-0000-0000-0000-000000000001");
  assert.equal(context.role, "OWNER");
});
