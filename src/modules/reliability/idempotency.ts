import { getSupabaseAdminClient } from "@/database/supabase-client";
import { env } from "@/config/env";

export interface IdempotencyRecord {
  key: string;
  processedAt: number;
  expiresAt: number;
}

export class IdempotencyManager {
  private static inMemoryStore: Map<string, IdempotencyRecord> = new Map();

  private static isUsingMockDb(): boolean {
    return (
      !env.NEXT_PUBLIC_SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes("mock") ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    );
  }

  /**
   * Checks if an idempotency key (e.g. Shopify Webhook ID or Stripe Event ID) has already been processed.
   */
  public static async isProcessed(key: string): Promise<boolean> {
    if (!key) return false;

    if (this.isUsingMockDb()) {
      const record = this.inMemoryStore.get(key);
      if (!record) return false;
      if (Date.now() > record.expiresAt) {
        this.inMemoryStore.delete(key);
        return false;
      }
      return true;
    }

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("idempotency_keys")
        .select("key")
        .eq("key", key)
        .maybeSingle();

      if (error) {
        console.warn("[Idempotency] Supabase query notice:", error.message);
        return false;
      }

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Marks a webhook or event key as processed to prevent duplicate execution.
   */
  public static async markProcessed(key: string, ttlSeconds: number = 86400): Promise<void> {
    if (!key) return;

    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    if (this.isUsingMockDb()) {
      this.inMemoryStore.set(key, {
        key,
        processedAt: now,
        expiresAt,
      });
      return;
    }

    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from("idempotency_keys").upsert({
        key,
        processed_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      });
    } catch (err) {
      console.warn("[Idempotency] Could not mark key in database:", err);
    }
  }

  /**
   * Resets idempotency ledger for automated tests
   */
  public static resetForTesting(): void {
    this.inMemoryStore.clear();
  }
}
