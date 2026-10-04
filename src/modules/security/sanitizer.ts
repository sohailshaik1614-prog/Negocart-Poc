/**
 * Security Input Sanitizer & Anti-Prompt-Injection Guard
 */
export class SecuritySanitizer {
  // Common jailbreak triggers and system prompt overrides
  private static readonly DANGEROUS_PATTERNS = [
    /ignore (all )?(previous|above|prior) (instructions|directions|prompts)/i,
    /system (override|prompt|instructions)/i,
    /you are now in (developer|dan|jailbreak|unrestricted) mode/i,
    /reveal your (secret|instructions|floor price|rules|prompt)/i,
    /<\|.*?\|>/g, // Special LLM token markers
    /```.*?(system|assistant).*?```/gis,
  ];

  /**
   * Sanitizes customer negotiation messages
   */
  public static sanitizeCustomerMessage(input: string): {
    cleanText: string;
    isSuspicious: boolean;
    threatDetected?: string;
  } {
    if (!input || typeof input !== "string") {
      return { cleanText: "", isSuspicious: false };
    }

    // Enforce reasonable length limit (max 500 characters for an offer note)
    let cleanText = input.trim().slice(0, 500);

    // Strip HTML/script tags
    cleanText = cleanText.replace(/<[^>]*>?/gm, "");

    // Check for prompt injection attempts
    let isSuspicious = false;
    let threatDetected: string | undefined;

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(cleanText)) {
        isSuspicious = true;
        threatDetected = `Pattern matched: ${pattern.toString()}`;
        // Neutralize the injection
        cleanText = cleanText.replace(pattern, "[sanitized]");
      }
    }

    return {
      cleanText,
      isSuspicious,
      threatDetected,
    };
  }

  /**
   * Validates and parses customer proposed numeric amounts safely
   */
  public static parseCustomerOffer(amount: unknown): number {
    if (typeof amount === "number") {
      if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
        throw new Error("Proposed offer must be a positive finite number");
      }
      return Math.round(amount * 100) / 100;
    }

    if (typeof amount === "string") {
      // Remove currency symbols, commas, whitespace
      const cleaned = amount.replace(/[₹$,\s]/g, "");
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
        throw new Error("Invalid offer amount provided");
      }
      return Math.round(parsed * 100) / 100;
    }

    throw new Error("Offer amount must be a number");
  }
}
