import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { ShopifyOAuth } from "@/modules/ecommerce/shopify/shopify-oauth";
import { ShopifyTokenVault } from "@/modules/ecommerce/shopify/shopify-token-vault";
import { ShopifySyncService } from "@/modules/ecommerce/shopify/shopify-sync-service";
import { ShopifyWebhookHandler } from "@/modules/ecommerce/shopify/shopify-webhook-handler";
import { HmacVerifier } from "@/modules/security/hmac";
import { NegoZaarRepository } from "@/database/repository";

test("Shopify OAuth: Domain Sanitization & Validation", () => {
  // Clean myshopify domain
  assert.equal(
    ShopifyOAuth.sanitizeShopDomain("apex-luxury.myshopify.com"),
    "apex-luxury.myshopify.com"
  );

  // Strip protocol and trailing path
  assert.equal(
    ShopifyOAuth.sanitizeShopDomain("https://apex-luxury.myshopify.com/admin/settings"),
    "apex-luxury.myshopify.com"
  );

  // Bare subdomain handles auto-appended
  assert.equal(
    ShopifyOAuth.sanitizeShopDomain("apex-luxury"),
    "apex-luxury.myshopify.com"
  );

  // Invalid domain formatting throws error
  assert.throws(
    () => ShopifyOAuth.sanitizeShopDomain("invalid store name!"),
    /Invalid Shopify store domain format/
  );
});

test("Shopify OAuth: CSRF Nonce State Generation & Verification", () => {
  const merchantId = "a0000000-0000-0000-0000-000000000001";
  const state = ShopifyOAuth.generateState(merchantId);

  assert.ok(state);
  assert.ok(typeof state === "string");

  // Verify valid state
  const payload = ShopifyOAuth.verifyState(state);
  assert.equal(payload.merchantId, merchantId);
  assert.ok(payload.timestamp > 0);
  assert.ok(payload.nonce);

  // Tampered state must be rejected
  const tamperedState = state.substring(0, state.length - 4) + "AAAA";
  assert.throws(() => ShopifyOAuth.verifyState(tamperedState), /Failed to verify OAuth state/);
});

test("Shopify OAuth: HMAC Query Parameter Verification", () => {
  const secret = "test_shopify_api_secret_key_123456789";
  const queryParams: Record<string, string> = {
    code: "auth_code_987654321",
    shop: "apex-luxury.myshopify.com",
    state: "valid_state_nonce",
    timestamp: "1710000000",
  };

  const hmac = HmacVerifier.generateShopifyQueryHmac(queryParams, secret);
  const fullParamsWithHmac = { ...queryParams, hmac };

  // Valid HMAC
  assert.equal(HmacVerifier.verifyShopifyQueryHmac(fullParamsWithHmac, secret), true);

  // Tampered parameter fails verification
  const tamperedParams = { ...fullParamsWithHmac, code: "tampered_code" };
  assert.equal(HmacVerifier.verifyShopifyQueryHmac(tamperedParams, secret), false);
});

test("Shopify Token Vault: AES-256-GCM Encryption and Decryption", () => {
  const plainToken = "shpat_live_apex_super_confidential_token_987";
  const encrypted = ShopifyTokenVault.encrypt(plainToken);

  assert.ok(encrypted);
  assert.notEqual(encrypted, plainToken);
  assert.equal(encrypted.split(":").length, 3); // iv:authTag:ciphertext

  const decrypted = ShopifyTokenVault.decrypt(encrypted);
  assert.equal(decrypted, plainToken);

  // Tampered ciphertext fails decryption
  const parts = encrypted.split(":");
  const tamperedEncrypted = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;
  assert.throws(() => ShopifyTokenVault.decrypt(tamperedEncrypted));
});

test("Shopify Sync Service: Connect Store and Initial Catalog Sync", async () => {
  NegoZaarRepository.resetForTesting();

  const merchantId = "a0000000-0000-0000-0000-000000000001";
  const shopDomain = "apex-luxury.myshopify.com";
  const testToken = "shpat_live_apex_mock_offline_token";

  const result = await ShopifySyncService.connectStore(merchantId, shopDomain, testToken, [
    "read_products",
    "write_price_rules",
  ]);

  assert.ok(result.store);
  assert.equal(result.store.platform, "SHOPIFY");
  assert.equal(result.store.platformStoreId, shopDomain);
  assert.equal(result.store.status, "ACTIVE");

  // Verify credentials in vault are encrypted
  const creds = await NegoZaarRepository.getStoreCredentials(result.store.id);
  assert.ok(creds);
  assert.notEqual(creds.encryptedAccessToken, testToken);
  assert.equal(ShopifyTokenVault.decrypt(creds.encryptedAccessToken), testToken);

  // Verify imported products in repository
  const products = await NegoZaarRepository.getProductsForStore(result.store.id);
  assert.ok(products.length >= 3);

  const watchProduct = products.find((p) => p.title.includes("Watch"));
  assert.ok(watchProduct);
  assert.equal(watchProduct.originalPrice, 7500);

  // Verify negotiation rules automatically set
  const watchRule = await NegoZaarRepository.getProductRule(result.store.id, watchProduct.id);
  assert.ok(watchRule);
  assert.equal(watchRule.isNegotiationEnabled, true);
  assert.ok(watchRule.minAcceptablePrice < watchProduct.originalPrice);
});

test("Shopify Webhook Handler: Product Lifecycle Events (Create, Update, Delete)", async () => {
  NegoZaarRepository.resetForTesting();

  const storeId = "d0000000-0000-0000-0000-000000000001";
  const shopDomain = "apex-luxury.myshopify.com";

  // 1. Product Create Webhook
  const createPayload = {
    id: 9911223344,
    title: "Handcrafted Italian Silk Scarf",
    handle: "handcrafted-italian-silk-scarf",
    status: "active",
    variants: [{ id: 112233, price: "3500.00", sku: "HISS-001", inventory_quantity: 20 }],
  };

  const createResult = await ShopifyWebhookHandler.handleWebhook(
    "products/create",
    shopDomain,
    createPayload
  );
  assert.equal(createResult.handled, true);

  const createdProduct = await NegoZaarRepository.getProductByExternalId(
    storeId,
    "gid://shopify/Product/9911223344"
  );
  assert.ok(createdProduct);
  assert.equal(createdProduct.title, "Handcrafted Italian Silk Scarf");
  assert.equal(createdProduct.originalPrice, 3500);

  // 2. Product Update Webhook (price lowered from 3500 to 3000)
  const updatePayload = {
    ...createPayload,
    title: "Handcrafted Italian Silk Scarf - Limited Edition",
    variants: [{ id: 112233, price: "3000.00", sku: "HISS-001", inventory_quantity: 18 }],
  };

  const updateResult = await ShopifyWebhookHandler.handleWebhook(
    "products/update",
    shopDomain,
    updatePayload
  );
  assert.equal(updateResult.handled, true);

  const updatedProduct = await NegoZaarRepository.getProductByExternalId(
    storeId,
    "gid://shopify/Product/9911223344"
  );
  assert.equal(updatedProduct?.title, "Handcrafted Italian Silk Scarf - Limited Edition");
  assert.equal(updatedProduct?.originalPrice, 3000);

  // 3. Product Delete Webhook
  const deleteResult = await ShopifyWebhookHandler.handleWebhook(
    "products/delete",
    shopDomain,
    { id: 9911223344 }
  );
  assert.equal(deleteResult.handled, true);

  const deletedCheck = await NegoZaarRepository.getProductByExternalId(
    storeId,
    "gid://shopify/Product/9911223344"
  );
  assert.equal(deletedCheck, null);
});

test("Shopify Webhook Handler: Order Conversion & Revenue Attribution", async () => {
  NegoZaarRepository.resetForTesting();
  const shopDomain = "apex-luxury.myshopify.com";

  const orderPayload = {
    id: 5849201948,
    order_number: 1042,
    total_price: "1650.00",
    currency: "INR",
    customer: { email: "customer@example.com" },
    discount_codes: [
      {
        code: "NEGO-9X4Z2A",
        amount: "350.00",
        type: "fixed_amount",
      },
    ],
  };

  const result = await ShopifyWebhookHandler.handleWebhook("orders/create", shopDomain, orderPayload);
  assert.equal(result.handled, true);

  // Check analytics events for attributed conversion
  const analytics = await NegoZaarRepository.getAnalyticsEvents({
    eventType: "ORDER_CONVERTED",
  });
  assert.equal(analytics.length, 1);
  assert.equal(analytics[0].properties.discountCode, "NEGO-9X4Z2A");
  assert.equal(analytics[0].properties.amount, 350);
});

test("Shopify Store Disconnection & App Uninstalled", async () => {
  NegoZaarRepository.resetForTesting();
  const shopDomain = "apex-luxury.myshopify.com";
  const storeId = "d0000000-0000-0000-0000-000000000001";

  // First save test credentials
  await NegoZaarRepository.saveStoreCredentials({
    id: crypto.randomUUID(),
    storeId,
    encryptedAccessToken: ShopifyTokenVault.encrypt("test_token"),
    scopes: ["read_products"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Receive app/uninstalled webhook from Shopify
  const result = await ShopifyWebhookHandler.handleWebhook("app/uninstalled", shopDomain, {});
  assert.equal(result.handled, true);

  const store = await NegoZaarRepository.getStoreById(storeId);
  assert.equal(store?.status, "DISCONNECTED");

  // Credentials should be purged from database
  const creds = await NegoZaarRepository.getStoreCredentials(storeId);
  assert.equal(creds, null);

  // Restore clean state for subsequent tests and dev server
  NegoZaarRepository.resetForTesting();
});
