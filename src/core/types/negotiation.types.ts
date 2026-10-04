export type SessionStatus = 
  | "INITIALIZED" 
  | "ACTIVE" 
  | "COUNTERED" 
  | "ACCEPTED" 
  | "REJECTED" 
  | "EXPIRED" 
  | "TERMINATED";

export type MessageSender = "CUSTOMER" | "AI_AGENT" | "SYSTEM";
export type OfferProposer = "CUSTOMER" | "AI_AGENT";

export interface NegotiationMessage {
  id: string;
  sessionId: string;
  senderRole: MessageSender;
  messageText: string;
  roundNumber: number;
  rawAiReasoning?: string; // Internal audit only, stripped from client view
  createdAt: string;
}

export interface NegotiationOffer {
  id: string;
  sessionId: string;
  roundNumber: number;
  proposedBy: OfferProposer;
  amount: number;
  currency: string;
  discountPercentage: number;
  guardrailStatus: "PASSED" | "CLAMPED" | "REJECTED";
  guardrailNotes?: string;
  createdAt: string;
}

export interface NegotiationSession {
  id: string;
  storeId: string;
  productId: string;
  customerId: string;
  sessionTokenHash: string;
  status: SessionStatus;
  currentRound: number;
  maxRounds: number;
  originalPrice: number;
  initialCustomerOffer?: number;
  finalAgreedPrice?: number;
  currency: string;
  expiresAt: string;
  closedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNegotiationSessionView {
  sessionId: string;
  status: SessionStatus;
  currentRound: number;
  maxRounds: number;
  originalPrice: number;
  currentOffer?: number;
  currency: string;
  product: {
    title: string;
    imageUrl?: string;
  };
  messages: Array<{
    id: string;
    senderRole: MessageSender;
    messageText: string;
    roundNumber: number;
    createdAt: string;
  }>;
}

export interface StartSessionRequest {
  publicStoreKey: string;
  productId: string;
  deviceFingerprint: string;
  customerEmail?: string;
}

export interface CustomerOfferRequest {
  sessionToken: string;
  proposedAmount: number;
  message?: string;
}

export interface AcceptDealRequest {
  sessionToken: string;
}

export interface DealAcceptanceResponse {
  success: boolean;
  agreedPrice: number;
  discountCode: string;
  checkoutUrl?: string;
  expiresAt: string;
}
