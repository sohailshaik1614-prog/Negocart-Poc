-- ============================================================================
-- NegoZaar Production Database Schema & Migration
-- Version: 1.0.0
-- Database: PostgreSQL 15+ / Supabase
-- Multi-Tenant Isolation with Foreign Keys, Check Constraints & Composite Indexes
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TENANTS & MERCHANTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    billing_email VARCHAR(255) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'FREE_TRIAL',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    max_stores INTEGER NOT NULL DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_merchant_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELINQUENT'))
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'OWNER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_user_role CHECK (role IN ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'))
);

CREATE INDEX IF NOT EXISTS idx_users_merchant_id ON users(merchant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ----------------------------------------------------------------------------
-- 2. STORES & ECOMMERCE CREDENTIAL VAULT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_store_id VARCHAR(255) NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    public_store_key VARCHAR(100) UNIQUE NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_store UNIQUE(platform, platform_store_id),
    CONSTRAINT check_store_status CHECK (status IN ('ACTIVE', 'PAUSED', 'DISCONNECTED'))
);

CREATE INDEX IF NOT EXISTS idx_stores_merchant_id ON stores(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_public_key ON stores(public_store_key);

CREATE TABLE IF NOT EXISTS store_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID UNIQUE NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    api_key VARCHAR(255),
    encrypted_api_secret TEXT,
    encrypted_webhook_secret TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS & NEGOTIATION RULES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_product_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    handle VARCHAR(500) NOT NULL,
    sku VARCHAR(100),
    original_price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    image_url TEXT,
    inventory_quantity INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_external_product UNIQUE(store_id, external_product_id),
    CONSTRAINT check_product_price CHECK (original_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TABLE IF NOT EXISTS product_negotiation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_negotiation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    min_acceptable_price NUMERIC(12, 2) NOT NULL,
    max_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 25.0,
    auto_accept_price NUMERIC(12, 2),
    max_negotiation_rounds INTEGER NOT NULL DEFAULT 3,
    strategy VARCHAR(50) NOT NULL DEFAULT 'MODERATE',
    min_order_quantity INTEGER NOT NULL DEFAULT 1,
    coupon_validity_hours INTEGER NOT NULL DEFAULT 24,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_pricing_strategy CHECK (strategy IN ('AGGRESSIVE', 'MODERATE', 'FRIENDLY')),
    CONSTRAINT check_rounds_bounds CHECK (max_negotiation_rounds BETWEEN 1 AND 10),
    CONSTRAINT check_discount_pct CHECK (max_discount_percentage BETWEEN 0 AND 95)
);

CREATE INDEX IF NOT EXISTS idx_rules_store_product ON product_negotiation_settings(store_id, product_id);

-- ----------------------------------------------------------------------------
-- 4. NEGOTIATION SESSIONS & MESSAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS negotiation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cart_reference VARCHAR(255),
    customer_id VARCHAR(255) NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    current_round INTEGER NOT NULL DEFAULT 0,
    max_rounds INTEGER NOT NULL DEFAULT 3,
    original_price NUMERIC(12, 2) NOT NULL,
    current_offer NUMERIC(12, 2),
    initial_customer_offer NUMERIC(12, 2),
    final_agreed_price NUMERIC(12, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    expires_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_session_status CHECK (
        status IN ('CREATED', 'ACTIVE', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'TERMINATED', 'FINAL_OFFER')
    )
);

CREATE INDEX IF NOT EXISTS idx_sessions_store_created ON negotiation_sessions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON negotiation_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON negotiation_sessions(status);

CREATE TABLE IF NOT EXISTS negotiation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    sender_role VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    round_number INTEGER NOT NULL DEFAULT 0,
    attempt_number INTEGER NOT NULL DEFAULT 0,
    customer_message TEXT,
    associated_offer NUMERIC(12, 2),
    raw_ai_reasoning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_round ON negotiation_messages(session_id, round_number);

CREATE TABLE IF NOT EXISTS negotiation_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    proposed_by VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    guardrail_status VARCHAR(50) NOT NULL DEFAULT 'PASSED',
    guardrail_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_session_round ON negotiation_offers(session_id, round_number);

-- ----------------------------------------------------------------------------
-- 5. ANALYTICS & WEBHOOK IDEMPOTENCY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID,
    event_type VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash VARCHAR(64),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_store_event ON analytics_events(store_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_occurred ON analytics_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ----------------------------------------------------------------------------
-- 6. SAAS SUBSCRIPTIONS & STRIPE BILLING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan_id VARCHAR(50) NOT NULL DEFAULT 'FREE_TRIAL',
    status VARCHAR(50) NOT NULL DEFAULT 'TRIALING',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_negotiations_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_sub_plan CHECK (plan_id IN ('FREE_TRIAL', 'STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE')),
    CONSTRAINT check_sub_status CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON merchant_subscriptions(stripe_subscription_id);

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_negotiation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenants can only read/write their own organization records
CREATE POLICY merchant_tenant_isolation ON merchants
    FOR ALL
    USING (id = (current_setting('app.current_merchant_id', true))::uuid);

CREATE POLICY store_tenant_isolation ON stores
    FOR ALL
    USING (merchant_id = (current_setting('app.current_merchant_id', true))::uuid);

CREATE POLICY product_tenant_isolation ON products
    FOR ALL
    USING (store_id IN (
        SELECT id FROM stores WHERE merchant_id = (current_setting('app.current_merchant_id', true))::uuid
    ));

CREATE POLICY session_tenant_isolation ON negotiation_sessions
    FOR ALL
    USING (merchant_id = (current_setting('app.current_merchant_id', true))::uuid);
