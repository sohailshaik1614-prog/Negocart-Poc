import { NegotiationStrategy } from "./rule.types";
import { MessageSender } from "./negotiation.types";

export type AIAction = "COUNTER" | "ACCEPT" | "REJECT" | "FINAL_OFFER";

export interface ConversationTurn {
  sender: MessageSender;
  text: string;
}

export interface AIPromptContext {
  productTitle: string;
  originalPrice: number;
  currency: string;
  currentRound: number;
  maxRounds: number;
  strategy: NegotiationStrategy;
  customerOffer: number;
  // Recommended safe target range passed to AI (Derived safely by rule engine)
  targetSuggestedCounter: number;
  minAllowedFloor: number;
  history: ConversationTurn[];
  merchantToneGuide?: string;
}

export interface AIDecision {
  action: AIAction;
  suggestedPrice: number;
  replyMessage: string;
  internalReasoning: string;
}

export interface INegotiationAIService {
  readonly providerName: string;
  generateNegotiationResponse(context: AIPromptContext): Promise<AIDecision>;
}
