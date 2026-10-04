import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NegoZaarRepository } from "../src/database/repository.ts";

beforeEach(() => {
  NegoZaarRepository.resetForTesting();
});

const DEFAULT_STORE_ID = "d0000000-0000-0000-0000-000000000001";

test("Product Management: Creates product with complete negotiation configuration", async () => {
  const created = await NegoZaarRepository.createProduct({
    storeId: DEFAULT_STORE_ID,
    title: "Handcrafted Silk Scarf",
    sku: "SCARF-SILK-001",
    originalPrice: 1200,
    currency: "INR",
    minAcceptablePrice: 900,
    isNegotiationEnabled: true,
    maxNegotiationRounds: 4,
    strategy: "FRIENDLY",
    autoAcceptPrice: 1100,
  });

  assert.ok(created.id);
  assert.equal(created.title, "Handcrafted Silk Scarf");
  assert.equal(created.originalPrice, 1200);
  assert.equal(created.currency, "INR");
  assert.ok(created.negotiationSettings);
  assert.equal(created.negotiationSettings.minAcceptablePrice, 900);
  assert.equal(created.negotiationSettings.maxNegotiationRounds, 4);
  assert.equal(created.negotiationSettings.strategy, "FRIENDLY");
  assert.equal(created.negotiationSettings.autoAcceptPrice, 1100);
});

test("Product Management: Rejects invalid pricing rules (floor exceeds original)", async () => {
  await assert.rejects(
    async () =>
      NegoZaarRepository.createProduct({
        storeId: DEFAULT_STORE_ID,
        title: "Invalid Price Product",
        originalPrice: 1000,
        minAcceptablePrice: 1500, // Floor higher than original!
      }),
    /Minimum acceptable price cannot exceed the original price/
  );

  await assert.rejects(
    async () =>
      NegoZaarRepository.createProduct({
        storeId: DEFAULT_STORE_ID,
        title: "Negative Price Product",
        originalPrice: -50,
        minAcceptablePrice: 10,
      }),
    /Original price must be greater than zero/
  );
});

test("Product Management: Retrieves single product with negotiation settings", async () => {
  const product = await NegoZaarRepository.getProductWithRules("e0000000-0000-0000-0000-000000000001");

  assert.ok(product);
  assert.equal(product.id, "e0000000-0000-0000-0000-000000000001");
  assert.equal(product.originalPrice, 2000);
  assert.ok(product.negotiationSettings);
  assert.equal(product.negotiationSettings.minAcceptablePrice, 1500);
});

test("Product Management: Updates product details and negotiation rules", async () => {
  const updated = await NegoZaarRepository.updateProduct("e0000000-0000-0000-0000-000000000001", {
    title: "Artisan Leather Weekend Duffel Bag (2026 Edition)",
    originalPrice: 2200,
    minAcceptablePrice: 1650,
    strategy: "AGGRESSIVE",
    maxNegotiationRounds: 2,
  });

  assert.equal(updated.title, "Artisan Leather Weekend Duffel Bag (2026 Edition)");
  assert.equal(updated.originalPrice, 2200);
  assert.equal(updated.negotiationSettings?.minAcceptablePrice, 1650);
  assert.equal(updated.negotiationSettings?.strategy, "AGGRESSIVE");
  assert.equal(updated.negotiationSettings?.maxNegotiationRounds, 2);
});

test("Product Management: Deletes product and associated negotiation rules", async () => {
  const deleted = await NegoZaarRepository.deleteProduct("e0000000-0000-0000-0000-000000000001");
  assert.equal(deleted, true);

  const found = await NegoZaarRepository.getProductById("e0000000-0000-0000-0000-000000000001");
  assert.equal(found, null);

  const rule = await NegoZaarRepository.getProductRule(DEFAULT_STORE_ID, "e0000000-0000-0000-0000-000000000001");
  assert.equal(rule, null);
});

test("Product Management: Lists and filters products for store", async () => {
  // Add a second product
  await NegoZaarRepository.createProduct({
    storeId: DEFAULT_STORE_ID,
    title: "Premium Wool Overcoat",
    sku: "COAT-002",
    originalPrice: 8000,
    minAcceptablePrice: 6500,
    isNegotiationEnabled: false,
  });

  const all = await NegoZaarRepository.getProductsForStore(DEFAULT_STORE_ID);
  assert.equal(all.length, 2);

  const filtered = await NegoZaarRepository.getProductsForStore(DEFAULT_STORE_ID, {
    search: "wool",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Premium Wool Overcoat");

  const enabledOnly = await NegoZaarRepository.getProductsForStore(DEFAULT_STORE_ID, {
    isNegotiationEnabled: true,
  });
  assert.equal(enabledOnly.length, 1);
  assert.equal(enabledOnly[0].id, "e0000000-0000-0000-0000-000000000001");
});
