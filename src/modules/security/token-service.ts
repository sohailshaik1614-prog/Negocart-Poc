import crypto from "crypto";
import { env } from "@/config/env";
import { InvalidSessionTokenError } from "@/core/errors/domain-errors";

export interface SessionTokenPayload {
  sessionId: string;
  storeId: string;
  productId: string;
  customerId: string;
  exp: number; // Unix timestamp in seconds
}

export class SessionTokenService {
  private static readonly secret = env.SESSION_JWT_SECRET;

  /**
   * Generates a tamper-proof signed session token for the client widget
   */
  public static generateToken(payload: Omit<SessionTokenPayload, "exp">, validityHours: number = 24): string {
    const fullPayload: SessionTokenPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + validityHours * 3600,
    };

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verifies the authenticity and expiration of a session token
   */
  public static verifyToken(token: string): SessionTokenPayload {
    if (!token || typeof token !== "string") {
      throw new InvalidSessionTokenError("Missing session token");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new InvalidSessionTokenError("Malformed session token format");
    }

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", this.secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      throw new InvalidSessionTokenError("Session token signature verification failed");
    }

    try {
      const payload: SessionTokenPayload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp < now) {
        throw new InvalidSessionTokenError("Session token has expired");
      }

      return payload;
    } catch (err) {
      if (err instanceof InvalidSessionTokenError) throw err;
      throw new InvalidSessionTokenError("Failed to decode session token payload");
    }
  }

  /**
   * Computes a SHA-256 hash of the token for database storage
   */
  public static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
