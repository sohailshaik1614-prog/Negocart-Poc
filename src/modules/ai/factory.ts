import { INegotiationAIService } from "@/core/types/ai.types";
import { MockNegotiationAIService } from "./providers/mock-provider";
import { OpenAINegotiationService } from "./providers/openai-provider";
import { GeminiNegotiationService } from "./providers/gemini-provider";
import { ResilientAIService } from "./resilient-ai-service";
import { env } from "@/config/env";

export class AIFactory {
  private static getRawProvider(overrideProvider?: string): INegotiationAIService {
    const provider = overrideProvider || env.AI_PROVIDER;

    switch (provider) {
      case "openai":
        if (!env.OPENAI_API_KEY) {
          return new MockNegotiationAIService();
        }
        return new OpenAINegotiationService(env.OPENAI_API_KEY, env.OPENAI_MODEL);

      case "gemini":
        if (!env.GEMINI_API_KEY) {
          return new MockNegotiationAIService();
        }
        return new GeminiNegotiationService(env.GEMINI_API_KEY, env.GEMINI_MODEL);

      case "mock":
      default:
        return new MockNegotiationAIService();
    }
  }

  public static getService(overrideProvider?: string): INegotiationAIService {
    const raw = this.getRawProvider(overrideProvider);
    return new ResilientAIService(raw);
  }
}
