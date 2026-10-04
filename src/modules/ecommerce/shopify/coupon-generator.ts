import crypto from "crypto";

export class CouponCodeGenerator {
  private static readonly CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Unambiguous alphanumeric

  /**
   * Generates a cryptographically random, human-friendly promo code
   * Example: NEGO-8J2M-94KQ
   */
  public static generate(prefix: string = "NEGO"): string {
    const bytes = crypto.randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += this.CHARSET[bytes[i] % this.CHARSET.length];
    }
    return `${prefix}-${code.slice(0, 4)}-${code.slice(4, 8)}`;
  }
}
