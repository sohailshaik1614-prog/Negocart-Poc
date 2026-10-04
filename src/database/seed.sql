-- ==============================================================================
-- NEGOZAAR DATABASE SEED SCRIPT (Architecture Reference Data)
-- ==============================================================================

-- 1. Create a reference Merchant
INSERT INTO merchants (id, name, slug, billing_email, tier, status, max_stores)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Apex Retail Brands',
    'apex-retail',
    'admin@apexretail.test',
    'GROWTH',
    'ACTIVE',
    3
) ON CONFLICT (id) DO NOTHING;

-- 2. Create SaaS User
INSERT INTO users (id, merchant_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'merchant@apexretail.test',
    'Priya Sharma',
    'OWNER'
) ON CONFLICT (id) DO NOTHING;

-- 3. Create Subscription Record
INSERT INTO subscriptions (id, merchant_id, plan_tier, status, monthly_negotiation_quota)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'GROWTH',
    'ACTIVE',
    2500
) ON CONFLICT (id) DO NOTHING;

-- 4. Create Connected Shopify Store
INSERT INTO stores (id, merchant_id, platform, platform_store_id, store_name, public_store_key, currency, status)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'SHOPIFY',
    'apex-luxury.myshopify.com',
    'Apex Luxury Lifestyle',
    'pub_live_apex_9a8b7c6d5e4f3a2b1c',
    'INR',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 5. Mock Synced Product from Shopify Store
INSERT INTO products (id, store_id, external_product_id, title, handle, sku, original_price, currency, inventory_quantity)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'gid://shopify/Product/8472910381',
    'Artisan Leather Weekend Duffel Bag',
    'artisan-leather-weekend-duffel-bag',
    'AL-BAG-001',
    2000.00,
    'INR',
    15
) ON CONFLICT (id) DO NOTHING;

-- 6. Configure Product Negotiation Rules (Floor price ₹1,500, Max discount 25%, 3 rounds)
INSERT INTO product_negotiation_settings (
    id,
    store_id,
    product_id,
    is_negotiation_enabled,
    min_acceptable_price,
    max_discount_percentage,
    auto_accept_price,
    max_negotiation_rounds,
    strategy,
    coupon_validity_hours
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    TRUE,
    1500.00,
    25.00,
    1850.00,
    3,
    'MODERATE',
    24
) ON CONFLICT (id) DO NOTHING;
