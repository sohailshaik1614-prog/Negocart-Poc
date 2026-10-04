import crypto from "crypto";
import { env } from "@/config/env";
import { UserRole } from "@/core/types/tenant.types";
import { DomainError } from "@/core/errors/domain-errors";

export interface MerchantTokenPayload {
  userId: string;
  merchantId: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

export class MerchantTokenService {
  private static readonly secret = env.SESSION_JWT_SECRET;

  /**
   * Generates a signed JWT session token for an authenticated merchant user
   */
  public static generateSessionToken(
    data: { userId: string; merchantId: string; role: UserRole; email: string },
    validityDays: number = 7
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: MerchantTokenPayload = {
      ...data,
      iat: now,
      exp: now + validityDays * 86400,
    };

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verifies and decodes a merchant session token
   */
  public static verifySessionToken(token: string): MerchantTokenPayload {
    if (!token || typeof token !== "string") {
      throw new DomainError("Missing merchant authentication token", 401, "UNAUTHORIZED");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new DomainError("Malformed session token format", 401, "INVALID_TOKEN");
    }

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", this.secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new DomainError("Invalid session token signature", 401, "INVALID_TOKEN");
    }

    try {
      const payload: MerchantTokenPayload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp < now) {
        throw new DomainError("Merchant session has expired", 401, "SESSION_EXPIRED");
      }

      return payload;
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError("Failed to decode token payload", 401, "INVALID_TOKEN");
    }
  }
}
