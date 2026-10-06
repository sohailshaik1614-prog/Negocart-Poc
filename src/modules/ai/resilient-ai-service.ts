import { AIDecision, AIPromptContext, INegotiationAIService } from "@/core/types/ai.types";
import { MockNegotiationAIService } from "./providers/mock-provider";
import { AICache } from "./cache";
import { AICostTracker } from "./cost-tracker";
import { Logger } from "../monitoring/logger";

export class ResilientAIService implements INegotiationAIService {
  public readonly providerName: string;
  private readonly primaryProvider: INegotiationAIService;
  private readonly fallbackProvider: INegotiationAIService;
  private readonly timeoutMs: number;

  constructor(primaryProvider: INegotiationAIService, timeoutMs: number = 5000) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = new MockNegotiationAIService();
    this.providerName = `resilient(${primaryProvider.providerName})`;
    this.timeoutMs = timeoutMs;
  }

  public async generateNegotiationResponse(context: AIPromptContext): Promise<AIDecision> {
    // 1. Check AI Cache
    const cached = AICache.get(context);
    if (cached) {
      Logger.debug("[AI Service] Cache hit for prompt context");
      return cached;
    }

    // 2. Execute Primary Provider with Timeout & Fallback
    let decision: AIDecision;
    let usedProvider = this.primaryProvider.providerName;

    try {
      decision = await this.executeWithTimeout(
        () => this.primaryProvider.generateNegotiationResponse(context),
        this.timeoutMs
      );
    } catch (error) {
      Logger.warn(
        `[AI Service] Primary provider ${this.primaryProvider.providerName} failed or timed out. Falling back to deterministic engine.`,
        { error: error instanceof Error ? error.message : String(error) }
      );

      usedProvider = "deterministic-fallback";
      decision = await this.fallbackProvider.generateNegotiationResponse(context);
    }

    // 3. Track Token Usage & Estimated Cost
    // Estimate token counts based on context text + response length (~4 chars per token)
    const promptLength = JSON.stringify(context).length;
    const responseLength = (decision.replyMessage + decision.internalReasoning).length;
    const promptTokens = Math.max(150, Math.round(promptLength / 4));
    const completionTokens = Math.max(30, Math.round(responseLength / 4));

    AICostTracker.trackUsage({
      sessionId: `session_turn_${context.currentRound}`,
      provider: usedProvider,
      promptTokens,
      completionTokens,
    });

    // 4. Save to Cache
    AICache.set(context, decision);

    return decision;
  }

  private executeWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`AI Provider timed out after ${ms}ms`));
      }, ms);

      fn()
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
