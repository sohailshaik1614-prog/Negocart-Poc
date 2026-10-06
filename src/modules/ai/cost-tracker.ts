export interface TokenUsageRecord {
  sessionId: string;
  storeId?: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
}

export class AICostTracker {
  private static usageRecords: TokenUsageRecord[] = [];

  // Provider rates per 1,000,000 tokens (USD)
  private static readonly RATES_PER_MILLION: Record<
    string,
    { input: number; output: number }
  > = {
    gemini: { input: 0.075, output: 0.30 }, // Gemini 1.5 Flash
    openai: { input: 0.15, output: 0.60 },  // GPT-4o-mini
    mock: { input: 0.0, output: 0.0 },
  };

  /**
   * Tracks tokens consumed by an AI completion call
   */
  public static trackUsage(params: {
    sessionId: string;
    storeId?: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
  }): TokenUsageRecord {
    const providerKey = params.provider.toLowerCase();
    const rates = this.RATES_PER_MILLION[providerKey] || this.RATES_PER_MILLION.gemini;

    const inputCost = (params.promptTokens / 1_000_000) * rates.input;
    const outputCost = (params.completionTokens / 1_000_000) * rates.output;
    const estimatedCostUsd = Number((inputCost + outputCost).toFixed(6));

    const record: TokenUsageRecord = {
      sessionId: params.sessionId,
      storeId: params.storeId,
      provider: params.provider,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      estimatedCostUsd,
      timestamp: new Date().toISOString(),
    };

    this.usageRecords.push(record);
    return record;
  }

  /**
   * Calculates total token consumption and costs for a store
   */
  public static getStoreUsageSummary(storeId: string): {
    totalTokens: number;
    totalCostUsd: number;
    totalCalls: number;
  } {
    const records = this.usageRecords.filter((r) => r.storeId === storeId);
    return {
      totalTokens: records.reduce((acc, r) => acc + r.totalTokens, 0),
      totalCostUsd: Number(records.reduce((acc, r) => acc + r.estimatedCostUsd, 0).toFixed(4)),
      totalCalls: records.length,
    };
  }

  /**
   * Calculates total tokens consumed in a single session
   */
  public static getSessionUsage(sessionId: string): {
    totalTokens: number;
    totalCostUsd: number;
    callsCount: number;
  } {
    const records = this.usageRecords.filter((r) => r.sessionId === sessionId);
    return {
      totalTokens: records.reduce((acc, r) => acc + r.totalTokens, 0),
      totalCostUsd: Number(records.reduce((acc, r) => acc + r.estimatedCostUsd, 0).toFixed(4)),
      callsCount: records.length,
    };
  }

  public static resetForTesting(): void {
    this.usageRecords = [];
  }
}
