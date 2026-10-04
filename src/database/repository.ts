import { ProductNegotiationSettings } from "@/core/types/rule.types";
import { Product } from "@/core/types/product.types";
import { Store } from "@/core/types/store.types";
import {
  NegotiationMessage,
  NegotiationOffer,
  NegotiationSession,
  SessionStatus,
} from "@/core/types/negotiation.types";
import { AnalyticsEvent } from "@/core/types/analytics.types";
import { getSupabaseAdminClient } from "./supabase-client";
import { env } from "@/config/env";

export interface TransactionRecord {
  id: string;
  sessionId: string;
  storeId: string;
  discountCode: string;
  claimToken: string;
  status: "GENERATED" | "CLAIMED" | "EXPIRED" | "REVOKED";
  originalPrice: number;
  negotiatedPrice: number;
  discountAmount: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Data Access Layer / Repository
 *
 * Implements Supabase DB access with seamless fallback to high-fidelity
 * in-memory storage when testing locally or running without live credentials.
 */
export class NegoZaarRepository {
  private static isUsingMockDb(): boolean {
    return (
      !env.NEXT_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    );
  }

  // ============================================================================
  // IN-MEMORY DATA STORE (For development, local POC, and unit/integration tests)
  // ============================================================================
  private static stores: Map<string, Store> = new Map([
    [
      "d0000000-0000-0000-0000-000000000001",
      {
        id: "d0000000-0000-0000-0000-000000000001",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        platform: "SHOPIFY",
        platformStoreId: "apex-luxury.myshopify.com",
        storeName: "Apex Luxury Lifestyle",
        publicStoreKey: "pub_live_apex_9a8b7c6d5e4f3a2b1c",
        currency: "INR",
        status: "ACTIVE",
        settings: {
          brandColor: "#16a34a",
          widgetTheme: "auto",
          position: "bottom-right",
          requireEmailToClaim: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  private static products: Map<string, Product> = new Map([
    [
      "e0000000-0000-0000-0000-000000000001",
      {
        id: "e0000000-0000-0000-0000-000000000001",
        storeId: "d0000000-0000-0000-0000-000000000001",
        externalProductId: "gid://shopify/Product/8472910381",
        title: "Artisan Leather Weekend Duffel Bag",
        handle: "artisan-leather-weekend-duffel-bag",
        sku: "AL-BAG-001",
        originalPrice: 2000.0,
        currency: "INR",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
        inventoryQuantity: 15,
        isActive: true,
        syncedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  private static rules: Map<string, ProductNegotiationSettings> = new Map([
    [
      "e0000000-0000-0000-0000-000000000001",
      {
        id: "f0000000-0000-0000-0000-000000000001",
        storeId: "d0000000-0000-0000-0000-000000000001",
        productId: "e0000000-0000-0000-0000-000000000001",
        isNegotiationEnabled: true,
        minAcceptablePrice: 1500.0, // Floor price: ₹1,500
        maxDiscountPercentage: 25.0,
        autoAcceptPrice: 1850.0,
        maxNegotiationRounds: 3,
        strategy: "MODERATE",
        minOrderQuantity: 1,
        couponValidityHours: 24,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  private static sessions: Map<string, NegotiationSession> = new Map();
  private static messages: Map<string, NegotiationMessage[]> = new Map();
  private static offers: Map<string, NegotiationOffer[]> = new Map();
  private static transactions: Map<string, TransactionRecord> = new Map();
  private static analytics: AnalyticsEvent[] = [];

  // ============================================================================
  // STORE REPOSITORY METHODS
  // ============================================================================
  public static async getStoreByPublicKey(key: string): Promise<Store | null> {
    if (this.isUsingMockDb()) {
      for (const store of this.stores.values()) {
        if (store.publicStoreKey === key) return store;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("public_store_key", key)
      .single();

    return (data as Store) || null;
  }

  public static async getStoreById(storeId: string): Promise<Store | null> {
    if (this.isUsingMockDb()) {
      return this.stores.get(storeId) || null;
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from("stores").select("*").eq("id", storeId).single();
    return (data as Store) || null;
  }

  public static async getStoresForMerchant(merchantId: string): Promise<Store[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.stores.values()).filter((s) => s.merchantId === merchantId);
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from("stores").select("*").eq("merchant_id", merchantId);
    return (data as Store[]) || [];
  }

  // ============================================================================
  // PRODUCT & RULE METHODS
  // ============================================================================
  public static async getProductById(productId: string): Promise<Product | null> {
    if (this.isUsingMockDb()) {
      return this.products.get(productId) || null;
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from("products").select("*").eq("id", productId).single();
    return (data as Product) || null;
  }

  public static async getProductsForStore(storeId: string): Promise<Product[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.products.values()).filter((p) => p.storeId === storeId);
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from("products").select("*").eq("store_id", storeId);
    return (data as Product[]) || [];
  }

  public static async getProductRule(storeId: string, productId?: string): Promise<ProductNegotiationSettings | null> {
    if (this.isUsingMockDb()) {
      if (productId && this.rules.has(productId)) {
        return this.rules.get(productId)!;
      }
      // Check store-wide fallback rule
      for (const rule of this.rules.values()) {
        if (rule.storeId === storeId && !rule.productId) return rule;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    if (productId) {
      const { data } = await supabase
        .from("product_negotiation_settings")
        .select("*")
        .eq("store_id", storeId)
        .eq("product_id", productId)
        .maybeSingle();

      if (data) return data as ProductNegotiationSettings;
    }

    // Fallback store rule
    const { data: storeRule } = await supabase
      .from("product_negotiation_settings")
      .select("*")
      .eq("store_id", storeId)
      .is("product_id", null)
      .maybeSingle();

    return (storeRule as ProductNegotiationSettings) || null;
  }

  public static async upsertProductRule(rule: ProductNegotiationSettings): Promise<void> {
    if (this.isUsingMockDb()) {
      if (rule.productId) {
        this.rules.set(rule.productId, rule);
      } else {
        this.rules.set(`store_${rule.storeId}`, rule);
      }
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("product_negotiation_settings").upsert(rule);
  }

  // ============================================================================
  // NEGOTIATION SESSIONS & MESSAGES
  // ============================================================================
  public static async createNegotiationSession(session: NegotiationSession): Promise<NegotiationSession> {
    if (this.isUsingMockDb()) {
      this.sessions.set(session.id, session);
      this.messages.set(session.id, []);
      this.offers.set(session.id, []);
      return session;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("negotiation_sessions")
      .insert({
        id: session.id,
        store_id: session.storeId,
        product_id: session.productId,
        customer_id: session.customerId,
        session_token_hash: session.sessionTokenHash,
        status: session.status,
        current_round: session.currentRound,
        max_rounds: session.maxRounds,
        original_price: session.originalPrice,
        initial_customer_offer: session.initialCustomerOffer,
        final_agreed_price: session.finalAgreedPrice,
        currency: session.currency,
        expires_at: session.expiresAt,
        metadata: session.metadata,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as NegotiationSession;
  }

  public static async getSessionById(sessionId: string): Promise<NegotiationSession | null> {
    if (this.isUsingMockDb()) {
      return this.sessions.get(sessionId) || null;
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    return (data as NegotiationSession) || null;
  }

  public static async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    finalAgreedPrice?: number
  ): Promise<void> {
    if (this.isUsingMockDb()) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = status;
        if (finalAgreedPrice !== undefined) {
          session.finalAgreedPrice = finalAgreedPrice;
        }
        if (["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(status)) {
          session.closedAt = new Date().toISOString();
        }
        session.updatedAt = new Date().toISOString();
      }
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase
      .from("negotiation_sessions")
      .update({
        status,
        final_agreed_price: finalAgreedPrice,
        closed_at: ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(status)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", sessionId);
  }

  public static async incrementSessionRound(sessionId: string): Promise<number> {
    if (this.isUsingMockDb()) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.currentRound += 1;
        session.updatedAt = new Date().toISOString();
        return session.currentRound;
      }
      return 1;
    }

    const supabase = getSupabaseAdminClient();
    const session = await this.getSessionById(sessionId);
    const newRound = (session?.currentRound ?? 0) + 1;
    await supabase
      .from("negotiation_sessions")
      .update({ current_round: newRound })
      .eq("id", sessionId);
    return newRound;
  }

  public static async addMessage(message: NegotiationMessage): Promise<void> {
    if (this.isUsingMockDb()) {
      const list = this.messages.get(message.sessionId) || [];
      list.push(message);
      this.messages.set(message.sessionId, list);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("negotiation_messages").insert({
      id: message.id,
      session_id: message.sessionId,
      sender_role: message.senderRole,
      message_text: message.messageText,
      round_number: message.roundNumber,
      raw_ai_reasoning: message.rawAiReasoning,
    });
  }

  public static async getSessionMessages(sessionId: string): Promise<NegotiationMessage[]> {
    if (this.isUsingMockDb()) {
      return this.messages.get(sessionId) || [];
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return (data as NegotiationMessage[]) || [];
  }

  public static async addOffer(offer: NegotiationOffer): Promise<void> {
    if (this.isUsingMockDb()) {
      const list = this.offers.get(offer.sessionId) || [];
      list.push(offer);
      this.offers.set(offer.sessionId, list);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("negotiation_offers").insert(offer);
  }

  // ============================================================================
  // TRANSACTIONS & CLAIMS
  // ============================================================================
  public static async createTransaction(tx: TransactionRecord): Promise<TransactionRecord> {
    if (this.isUsingMockDb()) {
      this.transactions.set(tx.id, tx);
      return tx;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert(tx)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as TransactionRecord;
  }

  // ============================================================================
  // ANALYTICS & AUDIT EVENT STREAM
  // ============================================================================
  public static async recordAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    if (this.isUsingMockDb()) {
      this.analytics.push(event);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("analytics_events").insert({
      id: event.id,
      store_id: event.storeId,
      session_id: event.sessionId,
      event_type: event.eventType,
      properties: event.properties,
      ip_hash: event.ipHash,
      occurred_at: event.occurredAt,
    });
  }

  public static async getRecentSessions(storeId: string, limit: number = 20): Promise<NegotiationSession[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.sessions.values())
        .filter((s) => s.storeId === storeId)
        .slice(-limit)
        .reverse();
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as NegotiationSession[]) || [];
  }
}
