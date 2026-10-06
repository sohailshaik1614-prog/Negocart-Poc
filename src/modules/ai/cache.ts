import crypto from "crypto";
import { AIDecision, AIPromptContext } from "@/core/types/ai.types";

interface CacheEntry {
  decision: AIDecision;
  expiresAt: number;
}

export class AICache {
  private static store: Map<string, CacheEntry> = new Map();
  private static readonly TTL_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Generates a deterministic cache key from the core negotiation parameters
   */
  public static computeKey(context: AIPromptContext): string {
    const raw = `${context.productTitle}:${context.originalPrice}:${context.customerOffer}:${context.currentRound}:${context.strategy}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  public static get(context: AIPromptContext): AIDecision | null {
    const key = this.computeKey(context);
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.decision;
  }

  public static set(context: AIPromptContext, decision: AIDecision): void {
    const key = this.computeKey(context);
    this.store.set(key, {
      decision,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  public static clear(): void {
    this.store.clear();
  }
}
