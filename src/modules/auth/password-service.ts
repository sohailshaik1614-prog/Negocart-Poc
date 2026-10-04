import crypto from "crypto";

export class PasswordService {
  private static readonly ITERATIONS = 100_000;
  private static readonly KEY_LEN = 64;
  private static readonly DIGEST = "sha512";

  /**
   * Hashes a password using PBKDF2 with a cryptographically secure random salt
   * Format: <salt_hex>:<hash_hex>
   */
  public static hashPassword(password: string): string {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LEN, this.DIGEST)
      .toString("hex");

    return `${salt}:${hash}`;
  }

  /**
   * Verifies a password against a stored hash in constant time
   */
  public static verifyPassword(password: string, storedHash: string): boolean {
    if (!password || !storedHash) return false;

    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;

    const [salt, expectedHash] = parts;
    try {
      const derivedHash = crypto
        .pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LEN, this.DIGEST)
        .toString("hex");

      const a = Buffer.from(derivedHash, "hex");
      const b = Buffer.from(expectedHash, "hex");

      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
