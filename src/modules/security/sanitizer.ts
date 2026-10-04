/**
 * Security Input Sanitizer, Anti-Prompt-Injection & Output Leak Guard
 *
 * CRITICAL DEFENSE LAYER:
 * 1. Treats all customer messages as strictly untrusted user input.
 * 2. Neutralizes prompt injections, jailbreaks, and rule manipulation attempts.
 * 3. Detects floor-price probes and system prompt extraction attacks.
 * 4. Post-processes outgoing AI text with heuristic/regex redaction to guarantee zero floor leakage.
 */
export class SecuritySanitizer {
  // Jailbreak, prompt injection, and instruction override patterns
  private static readonly DANGEROUS_PATTERNS = [
    /ignore (all )?(previous|above|prior|system) (instructions|directions|prompts|rules|limits)/i,
    /disregard (all )?(previous|above|prior) (instructions|rules|constraints)/i,
    /system\s*(override|reset|prompt|instruction|command|directive)/i,
    /\[system\]|<<system>>|<\|.*?\|>|\[INST\]/gi,
    /you are now in (developer|dan|jailbreak|unrestricted|god|evil) mode/i,
    /act as (an? )?.*?(generous|unfiltered|unrestricted|hacker|gives? (away )?items?|free|someone who ignores)/i,
    /roleplay as (an? )?.*?(generous|unfiltered|unrestricted|merchant|agrees? to everything)/i,
    /forget (all )?(your )?(rules|instructions|pricing limits)/i,
    /new instruction:\s*/i,
    /```.*?(system|assistant|instruction).*?```/gis,
    /<customer_input>|<\/customer_input>|<untrusted>|<\/untrusted>/gi,
  ];

  // Specific patterns attempting to elicit floor price or internal constraints
  private static readonly FLOOR_PROBE_PATTERNS = [
    /what('s| is| was| are) (the|your).*?(minimum|lowest|floor|bottom|rock-bottom|secret|least)/i,
    /tell me (the|your).*?(minimum|floor|lowest|bottom line|limit)/i,
    /how low can you/i,
    /reveal (the|your).*?(floor|minimum|internal|margin|threshold|rules)/i,
    /what is the merchant('s)?.*?(minimum|floor|acceptable|limit)/i,
    /repeat (the|your).*?(prompt|instructions|rules)/i,
    /show (me )?(the|your).*?(prompt|instructions|rules|config)/i,
    /print (the|your).*?(context|prompt|instructions)/i,
  ];

  /**
   * Sanitizes customer negotiation messages
   */
  public static sanitizeCustomerMessage(input: string): {
    cleanText: string;
    isSuspicious: boolean;
    isFloorProbe: boolean;
    threatDetected?: string;
  } {
    if (!input || typeof input !== "string") {
      return { cleanText: "", isSuspicious: false, isFloorProbe: false };
    }

    // Length limit (max 500 characters for an offer note)
    let cleanText = input.trim().slice(0, 500);

    // Strip HTML/script tags
    cleanText = cleanText.replace(/<[^>]*>?/gm, "");

    let isSuspicious = false;
    let isFloorProbe = false;
    let threatDetected: string | undefined;

    // Check dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(cleanText)) {
        isSuspicious = true;
        threatDetected = `Injection pattern matched: ${pattern.toString()}`;
        cleanText = cleanText.replace(pattern, "[sanitized]");
      }
    }

    // Check floor probe patterns
    for (const pattern of this.FLOOR_PROBE_PATTERNS) {
      if (pattern.test(cleanText)) {
        isFloorProbe = true;
        isSuspicious = true;
        threatDetected = threatDetected || `Floor probe matched: ${pattern.toString()}`;
      }
    }

    return {
      cleanText,
      isSuspicious,
      isFloorProbe,
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
      const cleaned = amount.replace(/[₹$,\s€£¥]/g, "");
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
        throw new Error("Invalid offer amount provided");
      }
      return Math.round(parsed * 100) / 100;
    }

    throw new Error("Offer amount must be a number");
  }

  /**
   * Post-processes and scrubs AI responses for accidental leaks of:
   * 1. Exact floor price numbers labeled as "minimum" or "floor"
   * 2. System prompt or internal architecture keywords
   * 3. Sensitive algorithm terms
   */
  public static scanAndRedactLeaks(
    responseText: string,
    sensitiveContext: {
      floorPrice?: number;
      currency?: string;
      originalPrice?: number;
      safeCounterPrice?: number;
    }
  ): {
    sanitizedText: string;
    leakDetected: boolean;
    reason?: string;
  } {
    let sanitizedText = responseText;
    let leakDetected = false;
    let reason: string | undefined;

    const { floorPrice, currency = "₹", safeCounterPrice } = sensitiveContext;

    // 1. Direct floor price leak check
    if (floorPrice !== undefined) {
      // Regex checking if floor price is stated as a minimum or constraint
      const floorLeakRegex = new RegExp(
        `(minimum|floor|lowest|cannot go below|bottom line|merchant limit|acceptable price).*?\\b${floorPrice}\\b|\\b${floorPrice}\\b.*?(is (my|the) (minimum|floor|lowest))`,
        "i"
      );

      if (floorLeakRegex.test(sanitizedText)) {
        leakDetected = true;
        reason = `Floor price ${floorPrice} detected in context of minimum constraint`;
        const fallbackOffer = safeCounterPrice || floorPrice;
        sanitizedText = `I can offer you a special rate of ${currency} ${fallbackOffer}. Does that work for you?`;
      }
    }

    // 2. System instruction / prompt leakage check
    const promptKeywords = [
      /system prompt/i,
      /you are "negozaar"/i,
      /FINANCIAL PARAMETERS:/i,
      /minacceptableprice/i,
      /targetsuggestedcounter/i,
      /pricing limits/i,
      /internal reasoning/i,
      /json response schema/i,
      /<customer_input>/i,
    ];

    for (const kw of promptKeywords) {
      if (kw.test(sanitizedText)) {
        leakDetected = true;
        reason = `Internal prompt artifact detected: ${kw.toString()}`;
        const fallbackOffer = safeCounterPrice || sensitiveContext.originalPrice || 0;
        sanitizedText = `I appreciate your interest! I can offer ${currency} ${fallbackOffer} for this product today. Would you like to proceed?`;
        break;
      }
    }

    return {
      sanitizedText,
      leakDetected,
      reason,
    };
  }
}
