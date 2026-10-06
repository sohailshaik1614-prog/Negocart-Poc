import crypto from "crypto";

export class HmacVerifier {
  /**
   * Verifies Shopify webhook HMAC-SHA256 signature in constant time
   */
  public static verifyShopifyHmac(rawBody: string, headerHmac: string, secret: string): boolean {
    if (!rawBody || !headerHmac || !secret) {
      return false;
    }

    try {
      const generatedHash = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      const a = Buffer.from(generatedHash, "utf8");
      const b = Buffer.from(headerHmac, "utf8");

      if (a.length !== b.length) {
        return false;
      }

      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Verifies Shopify OAuth query string HMAC in constant time
   * Required by Shopify OAuth specification.
   */
  public static verifyShopifyQueryHmac(
    queryParams: Record<string, string | string[] | undefined>,
    secret: string
  ): boolean {
    const providedHmac = queryParams.hmac;
    if (!providedHmac || typeof providedHmac !== "string" || !secret) {
      return false;
    }

    try {
      // 1. Filter out 'hmac' and 'signature' keys
      const sortedKeys = Object.keys(queryParams)
        .filter((k) => k !== "hmac" && k !== "signature")
        .sort();

      // 2. Build message as key=value&key=value
      const message = sortedKeys
        .map((k) => {
          const val = queryParams[k];
          return `${k}=${Array.isArray(val) ? val.join(",") : val ?? ""}`;
        })
        .join("&");

      // 3. Compute hex digest
      const computedHmac = crypto
        .createHmac("sha256", secret)
        .update(message, "utf8")
        .digest("hex");

      const a = Buffer.from(computedHmac, "utf8");
      const b = Buffer.from(providedHmac, "utf8");

      if (a.length !== b.length) {
        return false;
      }

      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Helper to compute OAuth query HMAC for testing or mock handshakes
   */
  public static generateShopifyQueryHmac(
    queryParams: Record<string, string>,
    secret: string
  ): string {
    const sortedKeys = Object.keys(queryParams)
      .filter((k) => k !== "hmac" && k !== "signature")
      .sort();

    const message = sortedKeys
      .map((k) => `${k}=${queryParams[k]}`)
      .join("&");

    return crypto
      .createHmac("sha256", secret)
      .update(message, "utf8")
      .digest("hex");
  }
}
