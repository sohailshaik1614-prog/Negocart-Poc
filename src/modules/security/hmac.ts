import crypto from "crypto";

export class HmacVerifier {
  /**
   * Verifies Shopify HMAC-SHA256 signature in constant time
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
}
