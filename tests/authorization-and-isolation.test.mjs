import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/modules/auth/auth-service.ts";
import { RBAC } from "../src/modules/auth/rbac.ts";
import { TenantContextManager } from "../src/modules/tenancy/tenant-context.ts";
import { NegoZaarRepository } from "../src/database/repository.ts";
import { NegotiationSessionManager } from "../src/modules/negotiation/session-manager.ts";
import { TenantAccessDeniedError } from "../src/core/errors/domain-errors.ts";

beforeEach(() => {
  NegoZaarRepository.resetForTesting();
});

test("RBAC: Role permissions boundaries are strictly enforced", () => {
  // OWNER has all permissions
  assert.equal(RBAC.hasPermission("OWNER", "products:write"), true);
  assert.equal(RBAC.hasPermission("OWNER", "billing:manage"), true);
  assert.equal(RBAC.hasPermission("OWNER", "rules:write"), true);

  // ADMIN has products and rules write, but not billing:manage
  assert.equal(RBAC.hasPermission("ADMIN", "products:write"), true);
  assert.equal(RBAC.hasPermission("ADMIN", "billing:manage"), false);

  // OPERATOR can configure rules, but cannot manage team or billing
  assert.equal(RBAC.hasPermission("OPERATOR", "rules:write"), true);
  assert.equal(RBAC.hasPermission("OPERATOR", "stores:write"), false);
  assert.equal(RBAC.hasPermission("OPERATOR", "team:manage"), false);

  // VIEWER has read-only access
  assert.equal(RBAC.hasPermission("VIEWER", "products:read"), true);
  assert.equal(RBAC.hasPermission("VIEWER", "products:write"), false);
  assert.equal(RBAC.hasPermission("VIEWER", "rules:write"), false);

  assert.throws(
    () => RBAC.assertPermission("VIEWER", "products:write"),
    /Forbidden/
  );
});

test("Tenant Isolation: Merchant A can NEVER access Merchant B's stores, products, or sessions", async () => {
  // 1. Setup Merchant A
  const authA = await AuthService.registerMerchant({
    email: "merchant_a@test.com",
    password: "Password123!",
    fullName: "Merchant A",
    merchantName: "Merchant Org A",
    storeName: "Store A",
  });

  const storeAId = authA.store.id;
  const productA = await NegoZaarRepository.createProduct({
    storeId: storeAId,
    title: "Product of Merchant A",
    originalPrice: 1000,
    minAcceptablePrice: 800,
  });

  const sessionA = await NegotiationSessionManager.startSession({
    storeId: storeAId,
    productId: productA.id,
  });

  // 2. Setup Merchant B
  const authB = await AuthService.registerMerchant({
    email: "merchant_b@test.com",
    password: "Password123!",
    fullName: "Merchant B",
    merchantName: "Merchant Org B",
    storeName: "Store B",
  });

  const storeBId = authB.store.id;
  const productB = await NegoZaarRepository.createProduct({
    storeId: storeBId,
    title: "Product of Merchant B",
    originalPrice: 5000,
    minAcceptablePrice: 4200,
  });

  const sessionB = await NegotiationSessionManager.startSession({
    storeId: storeBId,
    productId: productB.id,
  });

  const contextA = {
    userId: authA.user.id,
    merchantId: authA.merchant.id,
    role: authA.user.role,
    email: authA.user.email,
  };

  const contextB = {
    userId: authB.user.id,
    merchantId: authB.merchant.id,
    role: authB.user.role,
    email: authB.user.email,
  };

  // Test 1: Merchant A accesses own resources -> SUCCESS
  const allowedStoreA = await TenantContextManager.validateStoreAccess(contextA, storeAId);
  assert.equal(allowedStoreA.id, storeAId);

  const allowedProductA = await TenantContextManager.validateProductAccess(contextA, productA.id);
  assert.equal(allowedProductA.id, productA.id);

  const allowedSessionA = await TenantContextManager.validateSessionAccess(contextA, sessionA.session.id);
  assert.equal(allowedSessionA.id, sessionA.session.id);

  // Test 2: Merchant A attempts to access Merchant B's Store -> FORBIDDEN
  await assert.rejects(
    async () => TenantContextManager.validateStoreAccess(contextA, storeBId),
    TenantAccessDeniedError
  );

  // Test 3: Merchant A attempts to access Merchant B's Product -> FORBIDDEN
  await assert.rejects(
    async () => TenantContextManager.validateProductAccess(contextA, productB.id),
    TenantAccessDeniedError
  );

  // Test 4: Merchant A attempts to access Merchant B's Negotiation Session -> FORBIDDEN
  await assert.rejects(
    async () => TenantContextManager.validateSessionAccess(contextA, sessionB.session.id),
    TenantAccessDeniedError
  );

  // Test 5: Merchant B attempts to access Merchant A's resources -> FORBIDDEN
  await assert.rejects(
    async () => TenantContextManager.validateStoreAccess(contextB, storeAId),
    TenantAccessDeniedError
  );
  await assert.rejects(
    async () => TenantContextManager.validateProductAccess(contextB, productA.id),
    TenantAccessDeniedError
  );
});
