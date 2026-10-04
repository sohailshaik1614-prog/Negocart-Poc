-- ==============================================================================
-- NEGOZAAR MIGRATION 002: CORE BACKEND ENHANCEMENTS
-- Adds password hashing for native authentication, merchant_id & current_offer 
-- on negotiation sessions, and structured message fields for customer/AI turns.
-- ==============================================================================

-- 1. Add password_hash to users for native SaaS merchant authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Enhance negotiation_sessions with direct merchant_id, current_offer, cart_reference, and attempt_number
ALTER TABLE negotiation_sessions ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE;
ALTER TABLE negotiation_sessions ADD COLUMN IF NOT EXISTS cart_reference VARCHAR(255);
ALTER TABLE negotiation_sessions ADD COLUMN IF NOT EXISTS current_offer NUMERIC(12, 2);
ALTER TABLE negotiation_sessions ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 0;

-- Backfill existing negotiation_sessions merchant_id from stores if any exist
UPDATE negotiation_sessions s
SET merchant_id = st.merchant_id
FROM stores st
WHERE s.store_id = st.id AND s.merchant_id IS NULL;

-- 3. Enhance negotiation_messages with explicit customer_message, ai_response, associated_offer, and attempt_number
ALTER TABLE negotiation_messages ADD COLUMN IF NOT EXISTS customer_message TEXT;
ALTER TABLE negotiation_messages ADD COLUMN IF NOT EXISTS ai_response TEXT;
ALTER TABLE negotiation_messages ADD COLUMN IF NOT EXISTS associated_offer NUMERIC(12, 2);
ALTER TABLE negotiation_messages ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 0;

-- 4. Indexes for high-performance multi-tenant querying
CREATE INDEX IF NOT EXISTS idx_sessions_merchant ON negotiation_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_merchant_status ON negotiation_sessions(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_session_attempt ON negotiation_messages(session_id, attempt_number);
