# NegoZaar — AI Negotiation SaaS for E-Commerce Merchants

> **IMPORTANT ARCHITECTURAL NOTICE**: NegoZaar is **NOT** an e-commerce storefront, marketplace, or standalone shopping website. It is a multi-tenant B2B SaaS platform that integrates with existing merchant storefronts (starting with Shopify) to provide an AI-powered dynamic price negotiation layer with deterministic margin guardrails.

---

## Key Features

- **Deterministic Pricing Guard**: Hard mathematical enforcement ensuring no customer or AI hallucination can ever breach merchant floor prices or discount ceilings.
- **Zero Floor Leakage**: Absolute merchant minimum acceptable prices remain 100% confidential and are never transmitted to the browser.
- **Multi-Tenant SaaS Architecture**: PostgreSQL schema with Row-Level Security (RLS) isolating merchant data, credentials, and sessions.
- **AI Service Abstraction**: Pluggable provider layer supporting OpenAI, Google Gemini, Anthropic, or an offline Mock provider.
- **Embeddable Storefront SDK**: Lightweight JS snippet (`negozaar.js`) rendering a sandboxed modal on the merchant's store.
- **Shopify Platform Adapter**: Generation of single-use, time-limited discount coupons with automated checkout redirect and webhook order attribution.
- **Merchant Management Console**: Real-time KPI dashboards, pricing rule configuration, and full conversational audit trails.

---

## Quick Start

### 1. Prerequisites
- Node.js 18+ or 20+ (Tested on Node v24)
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(For local testing and evaluation, default settings use the zero-setup Mock AI Provider and local database repository out-of-the-box!)*

### 4. Run Automated Tests
```bash
npm test
```
Runs the test suite verifying:
- Floor price enforcement & discount ceiling protection
- Dynamic concession curves matching benchmark negotiation flows
- Prompt injection & hallucination clamping
- State machine transition rules
- Cryptographic session token verification and anti-tampering

### 5. Start Development Server
```bash
npm run dev
```
Visit `http://localhost:3000`:
- **Merchant Portal**: `http://localhost:3000/dashboard`
- **Pricing Rules Configuration**: `http://localhost:3000/rules`
- **Live Sessions & Transcripts**: `http://localhost:3000/sessions`
- **Stores & SDK Integration**: `http://localhost:3000/stores`
- **Negotiation Sandbox Simulator**: `http://localhost:3000/widget-sandbox`

### 6. Build for Production
```bash
npm run build
npm start
```

---

## Project Structure

```
src/
├── app/
│   ├── (merchant)/           # Merchant B2B SaaS Dashboard UI
│   │   ├── dashboard/        # KPI metrics & conversion overview
│   │   ├── rules/            # Pricing rules & floor price configuration
│   │   ├── sessions/         # Live transcripts & guardrail audit inspector
│   │   ├── stores/           # Storefront integration & SDK snippet
│   │   └── widget-sandbox/   # Interactive merchant negotiation simulator
│   ├── api/
│   │   ├── health/           # System health check
│   │   ├── v1/merchant/      # Protected merchant CRUD APIs
│   │   ├── v1/widget/        # Public storefront session & message APIs
│   │   └── v1/webhooks/      # Shopify HMAC webhook receiver
│   ├── embed/
│   │   └── widget/           # Sandboxed iframe negotiation modal for shoppers
│   ├── layout.tsx
│   └── page.tsx              # B2B SaaS platform overview
├── config/
│   └── env.ts                # Zod environment variable validation
├── core/
│   ├── types/                # Domain models (tenant, rule, negotiation, guardrail)
│   └── errors/               # Domain-specific typed error classes
├── database/
│   ├── migrations/           # PostgreSQL DDL migrations with RLS policies
│   ├── repository.ts         # Unified repository (Supabase + fallback)
│   ├── schema.ts             # Schema typing
│   ├── seed.sql              # Reference seed data
│   └── supabase-client.ts    # Server & client Supabase factories
├── modules/
│   ├── ai/                   # AI service abstraction (OpenAI, Gemini, Mock)
│   ├── auth/                 # Supabase Auth integration & RBAC
│   ├── ecommerce/            # Shopify adapter & coupon code generator
│   ├── negotiation/          # State machine, session manager, offer evaluator
│   ├── rules/                # Deterministic Pricing Guard engine
│   ├── security/             # Signed session tokens, rate limiter, sanitizers
│   └── tenancy/              # Multi-tenant isolation & store access validators
└── public/
    └── sdk/
        └── negozaar.js       # Storefront embed script for merchant stores
```
