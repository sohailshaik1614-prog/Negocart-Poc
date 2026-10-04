import { z } from "zod";
import { AIDecision, AIPromptContext, INegotiationAIService } from "@/core/types/ai.types";
import { PromptCompiler } from "../prompt-compiler";

const aiResponseSchema = z.object({
  action: z.enum(["COUNTER", "ACCEPT", "REJECT", "FINAL_OFFER"]),
  suggestedPrice: z.number().positive(),
  replyMessage: z.string().min(1),
  internalReasoning: z.string().default("No explicit reasoning provided"),
});

export class OpenAINegotiationService implements INegotiationAIService {
  public readonly providerName = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini"
  ) {}

  public async generateNegotiationResponse(context: AIPromptContext): Promise<AIDecision> {
    const systemPrompt = PromptCompiler.compileSystemPrompt(context);
    const userPrompt = PromptCompiler.compileUserPrompt(context);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty completion from OpenAI");
    }

    const parsedJson = JSON.parse(content);
    return aiResponseSchema.parse(parsedJson);
  }
}
