import { z } from "zod";
import { AIDecision, AIPromptContext, INegotiationAIService } from "@/core/types/ai.types";
import { PromptCompiler } from "../prompt-compiler";

const aiResponseSchema = z.object({
  action: z.enum(["COUNTER", "ACCEPT", "REJECT", "FINAL_OFFER"]),
  suggestedPrice: z.number().positive(),
  replyMessage: z.string().min(1),
  internalReasoning: z.string().default("No explicit reasoning provided"),
});

export class GeminiNegotiationService implements INegotiationAIService {
  public readonly providerName = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-1.5-flash"
  ) {}

  public async generateNegotiationResponse(context: AIPromptContext): Promise<AIDecision> {
    const systemPrompt = PromptCompiler.compileSystemPrompt(context);
    const userPrompt = PromptCompiler.compileUserPrompt(context);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty completion from Gemini API");
    }

    const parsedJson = JSON.parse(rawText);
    return aiResponseSchema.parse(parsedJson);
  }
}
