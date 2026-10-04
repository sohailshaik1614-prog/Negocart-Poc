-- ==============================================================================
-- NEGOZAAR PRODUCTION DATABASE SCHEMA
-- Target Database: PostgreSQL 15+ / Supabase
-- Multi-Tenant SaaS Architecture with Tenant Isolation via Row-Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS & DOMAINS
-- ==============================================================================
CREATE TYPE merchant_tier AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');
CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');
CREATE TYPE subscription_status AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');
CREATE TYPE ecommerce_platform AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'BIGCOMMERCE', 'MAGENTO', 'CUSTOM');
CREATE TYPE store_status AS ENUM ('ACTIVE', 'PAUSED', 'DISCONNECTED');
CREATE TYPE negotiation_strategy AS ENUM ('AGGRESSIVE', 'MODERATE', 'FRIENDLY');
CREATE TYPE session_status AS ENUM ('INITIALIZED', 'ACTIVE', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'TERMINATED');
CREATE TYPE message_sender AS ENUM ('CUSTOMER', 'AI_AGENT', 'SYSTEM');
CREATE TYPE offer_proposer AS ENUM ('CUSTOMER', 'AI_AGENT');
CREATE TYPE guardrail_verdict AS ENUM ('PASSED', 'CLAMPED', 'REJECTED');
CREATE TYPE transaction_status AS ENUM ('GENERATED', 'CLAIMED', 'EXPIRED', 'REVOKED');
CREATE TYPE attribution_status AS ENUM ('ATTRIBUTED', 'UNATTRIBUTED', 'MANUAL');

-- ==============================================================================
-- 2. TENANTS & USERS (Multi-Tenant Isolation Layer)
-- ==============================================================================

-- Merchants (Tenant Organizations)
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    billing_email VARCHAR(255) NOT NULL,
    tier merchant_tier NOT NULL DEFAULT 'STARTER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    max_stores INT NOT NULL DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (Merchant Team Members linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE, -- Supabase auth.users reference
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'VIEWER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscription Information (SaaS Billing & Quotas)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
    plan_tier merchant_tier NOT NULL DEFAULT 'STARTER',
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    monthly_negotiation_quota INT NOT NULL DEFAULT 500,
    current_cycle_negotiations INT NOT NULL DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. STORES & CREDENTIALS
-- ==============================================================================

-- Stores (Ecommerce integrations owned by merchants)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    platform ecommerce_platform NOT NULL DEFAULT 'SHOPIFY',
    platform_store_id VARCHAR(255) NOT NULL, -- e.g., myshop.myshopify.com
    store_name VARCHAR(255) NOT NULL,
    public_store_key VARCHAR(64) NOT NULL UNIQUE, -- Public token used in storefront widget embed
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status store_status NOT NULL DEFAULT 'ACTIVE',
    settings JSONB NOT NULL DEFAULT '{
        "widget_theme": "auto",
        "brand_color": "#16a34a",
        "position": "bottom-right",
        "require_email_to_claim": false
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_merchant_platform_store UNIQUE(merchant_id, platform, platform_store_id)
);

-- API & Integration Credentials (Encrypted platform tokens)
CREATE TABLE IF NOT EXISTS store_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    api_key VARCHAR(255),
    encrypted_api_secret TEXT,
    encrypted_webhook_secret TEXT,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. PRODUCTS & NEGOTIATION RULES
-- ==============================================================================

-- Products (Synced read metadata from merchant store)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_product_id VARCHAR(255) NOT NULL, -- Shopify Product GID
    title VARCHAR(500) NOT NULL,
    handle VARCHAR(500),
    sku VARCHAR(255),
    original_price NUMERIC(12, 2) NOT NULL CHECK (original_price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    image_url TEXT,
    inventory_quantity INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_store_external_product UNIQUE(store_id, external_product_id)
);

-- Product Negotiation Settings (Merchant Defined Rules & Pricing Limits)
-- If product_id IS NULL, this row represents the STORE-WIDE DEFAULT RULE
CREATE TABLE IF NOT EXISTS product_negotiation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    is_negotiation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- PRICING GUARDRAIL CRITICAL CONFIGURATION
    -- Floor price: Minimum acceptable price the AI can ever offer or accept.
    -- NEVER EXPOSED TO STOREFRONT/CLIENT.
    min_acceptable_price NUMERIC(12, 2) NOT NULL CHECK (min_acceptable_price >= 0),
    max_discount_percentage NUMERIC(5, 2) NOT NULL CHECK (max_discount_percentage >= 0 AND max_discount_percentage <= 100),
    auto_accept_price NUMERIC(12, 2) CHECK (auto_accept_price >= min_acceptable_price),
    
    -- BEHAVIORAL LIMITS
    max_negotiation_rounds INT NOT NULL DEFAULT 3 CHECK (max_negotiation_rounds BETWEEN 1 AND 10),
    strategy negotiation_strategy NOT NULL DEFAULT 'MODERATE',
    min_order_quantity INT NOT NULL DEFAULT 1 CHECK (min_order_quantity >= 1),
    coupon_validity_hours INT NOT NULL DEFAULT 24 CHECK (coupon_validity_hours >= 1),
    custom_system_prompt_addon TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_store_product_rule UNIQUE(store_id, product_id)
);

-- ==============================================================================
-- 5. STOREFRONT CUSTOMERS & SESSIONS
-- ==============================================================================

-- Customers (End shoppers interacting with widget)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_customer_id VARCHAR(255), -- If logged in on Shopify
    email VARCHAR(255),
    anonymous_device_hash VARCHAR(64) NOT NULL, -- Fingerprint for rate-limiting & anti-abuse
    total_negotiations_count INT NOT NULL DEFAULT 0,
    successful_negotiations_count INT NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_store_device UNIQUE(store_id, anonymous_device_hash)
);

-- Negotiation Sessions (Core state machine record)
CREATE TABLE IF NOT EXISTS negotiation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE, -- HMAC signature hash for browser token
    
    status session_status NOT NULL DEFAULT 'INITIALIZED',
    current_round INT NOT NULL DEFAULT 0,
    max_rounds INT NOT NULL DEFAULT 3,
    
    -- FINANCIAL AUDIT TRAIL
    original_price NUMERIC(12, 2) NOT NULL,
    initial_customer_offer NUMERIC(12, 2),
    final_agreed_price NUMERIC(12, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    
    expires_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Negotiation Messages (Chat Transcript)
CREATE TABLE IF NOT EXISTS negotiation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    sender_role message_sender NOT NULL,
    message_text TEXT NOT NULL,
    round_number INT NOT NULL DEFAULT 0,
    raw_ai_reasoning TEXT, -- Stored exclusively for merchant analytics/audit; NEVER sent to customer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structured Offers (Strict financial proposal records)
CREATE TABLE IF NOT EXISTS negotiation_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    proposed_by offer_proposer NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    discount_percentage NUMERIC(5, 2) NOT NULL,
    guardrail_status guardrail_verdict NOT NULL DEFAULT 'PASSED',
    guardrail_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. TRANSACTIONS, DISCOUNTS & ORDER ATTRIBUTION
-- ==============================================================================

-- Transactions (Generated claims, discount coupons and redemptions)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE REFERENCES negotiation_sessions(id) ON DELETE RESTRICT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    discount_code VARCHAR(100) NOT NULL,
    claim_token VARCHAR(64) NOT NULL UNIQUE,
    status transaction_status NOT NULL DEFAULT 'GENERATED',
    original_price NUMERIC(12, 2) NOT NULL,
    negotiated_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders (Attributed ecommerce orders back from Shopify webhooks)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES negotiation_sessions(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    external_order_id VARCHAR(255) NOT NULL, -- Shopify Order ID
    order_number VARCHAR(100),
    total_price NUMERIC(12, 2) NOT NULL,
    discount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    customer_email VARCHAR(255),
    attribution_status attribution_status NOT NULL DEFAULT 'ATTRIBUTED',
    raw_webhook_data JSONB,
    placed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_store_external_order UNIQUE(store_id, external_order_id)
);

-- ==============================================================================
-- 7. ANALYTICS & AUDIT EVENT STREAM
-- ==============================================================================

-- Analytics Events (Time-series event stream for merchant reporting & AI training)
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES negotiation_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash VARCHAR(64),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. INDEXES FOR HIGH-THROUGHPUT & LOW-LATENCY QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_merchant ON users(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_merchant ON stores(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_public_key ON stores(public_store_key);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_product_id);
CREATE INDEX IF NOT EXISTS idx_rules_store_product ON product_negotiation_settings(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_device ON customers(store_id, anonymous_device_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_store ON negotiation_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_sessions_product ON negotiation_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON negotiation_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON negotiation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session ON negotiation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_offers_session ON negotiation_offers(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(discount_code);
CREATE INDEX IF NOT EXISTS idx_transactions_claim_token ON transactions(claim_token);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_store_event ON analytics_events(store_id, event_type, occurred_at);

-- ==============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT ISOLATION
-- ==============================================================================
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_negotiation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Helper function: Get merchant ID for current authenticated user
CREATE OR REPLACE FUNCTION current_user_merchant_id() 
RETURNS UUID AS $$
    SELECT merchant_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policy: Merchants
CREATE POLICY merchant_isolation_policy ON merchants
    FOR ALL
    USING (id = current_user_merchant_id());

-- RLS Policy: Stores
CREATE POLICY store_isolation_policy ON stores
    FOR ALL
    USING (merchant_id = current_user_merchant_id());

-- RLS Policy: Products
CREATE POLICY product_isolation_policy ON products
    FOR ALL
    USING (store_id IN (SELECT id FROM stores WHERE merchant_id = current_user_merchant_id()));

-- RLS Policy: Product Rules
-- CRITICAL SECURITY RULE: The merchant can read/write their rules.
-- Public Storefront / Anonymous Widget users NEVER have direct SQL access to this table.
-- Widget queries pass strictly through the server-side API Gateway.
CREATE POLICY rule_isolation_policy ON product_negotiation_settings
    FOR ALL
    USING (store_id IN (SELECT id FROM stores WHERE merchant_id = current_user_merchant_id()));

-- RLS Policy: Sessions & Messages
CREATE POLICY session_isolation_policy ON negotiation_sessions
    FOR ALL
    USING (store_id IN (SELECT id FROM stores WHERE merchant_id = current_user_merchant_id()));

CREATE POLICY message_isolation_policy ON negotiation_messages
    FOR ALL
    USING (session_id IN (
        SELECT id FROM negotiation_sessions 
        WHERE store_id IN (SELECT id FROM stores WHERE merchant_id = current_user_merchant_id())
    ));

-- ==============================================================================
-- 10. AUTOMATIC TIMESTAMPS
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_merchants ON merchants;
CREATE TRIGGER set_timestamp_merchants BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_stores ON stores;
CREATE TRIGGER set_timestamp_stores BEFORE UPDATE ON stores FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_products ON products;
CREATE TRIGGER set_timestamp_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_rules ON product_negotiation_settings;
CREATE TRIGGER set_timestamp_rules BEFORE UPDATE ON product_negotiation_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_sessions ON negotiation_sessions;
CREATE TRIGGER set_timestamp_sessions BEFORE UPDATE ON negotiation_sessions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
