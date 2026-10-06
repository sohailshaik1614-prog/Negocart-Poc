import crypto from "crypto";
import { env } from "@/config/env";

/**
 * ShopifyTokenVault
 * 
 * Provides AES-256-GCM authenticated encryption for permanent Shopify OAuth access tokens
 * and API secrets before persistence into the database.
 */
export class ShopifyTokenVault {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;

  private static getKey(): Buffer {
    const rawKey = env.ENCRYPTION_KEY || "development_secret_32_characters_key_negozaar_poc";
    // Derive 32-byte key using SHA-256 if string length is not exactly 32
    return crypto.createHash("sha256").update(rawKey).digest();
  }

  /**
   * Encrypts plain token into format: `iv:authTag:ciphertext` (hex encoded)
   */
  public static encrypt(plainToken: string): string {
    if (!plainToken) return "";

    const key = this.getKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plainToken, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypts encrypted token format: `iv:authTag:ciphertext`
   */
  public static decrypt(encryptedPayload: string): string {
    if (!encryptedPayload) return "";

    // Support fallback for unencrypted tokens in local testing
    if (!encryptedPayload.includes(":")) {
      return encryptedPayload;
    }

    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted token format in vault");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = this.getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
