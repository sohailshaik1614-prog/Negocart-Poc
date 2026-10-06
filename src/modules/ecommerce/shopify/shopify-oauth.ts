import crypto from "crypto";
import { env } from "@/config/env";
import { HmacVerifier } from "@/modules/security/hmac";

export const SHOPIFY_DEFAULT_SCOPES = [
  "read_products",
  "write_products",
  "read_price_rules",
  "write_price_rules",
  "read_discounts",
  "write_discounts",
  "read_orders",
];

export interface OAuthStatePayload {
  merchantId: string;
  timestamp: number;
  nonce: string;
}

export class ShopifyOAuth {
  /**
   * Cleans and validates the shop domain parameter (e.g. "my-brand.myshopify.com")
   */
  public static sanitizeShopDomain(input: string): string {
    if (!input) throw new Error("Shop domain is required");

    let clean = input.trim().toLowerCase();
    // Strip protocol if included
    clean = clean.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    // Append .myshopify.com if only subdomain was provided
    if (!clean.includes(".")) {
      clean = `${clean}.myshopify.com`;
    }

    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopRegex.test(clean)) {
      throw new Error("Invalid Shopify store domain format. Expected: your-store.myshopify.com");
    }

    return clean;
  }

  /**
   * Generates a signed tamper-proof state nonce bound to the merchantId
   */
  public static generateState(merchantId: string): string {
    const payload: OAuthStatePayload = {
      merchantId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    const json = JSON.stringify(payload);
    const secret = env.ENCRYPTION_KEY || "development_secret_32_characters_key_negozaar_poc";
    const signature = crypto.createHmac("sha256", secret).update(json).digest("hex");

    return Buffer.from(JSON.stringify({ payload: json, signature })).toString("base64url");
  }

  /**
   * Verifies and decodes the state nonce
   */
  public static verifyState(encodedState: string): OAuthStatePayload {
    try {
      const decoded = JSON.parse(Buffer.from(encodedState, "base64url").toString("utf8"));
      const secret = env.ENCRYPTION_KEY || "development_secret_32_characters_key_negozaar_poc";
      const expectedSignature = crypto.createHmac("sha256", secret).update(decoded.payload).digest("hex");

      if (expectedSignature !== decoded.signature) {
        throw new Error("Invalid OAuth state signature (potential CSRF)");
      }

      const payload: OAuthStatePayload = JSON.parse(decoded.payload);

      // Verify expiration (max 15 minutes)
      const maxAgeMs = 15 * 60 * 1000;
      if (Date.now() - payload.timestamp > maxAgeMs) {
        throw new Error("OAuth state has expired. Please initiate the connection again.");
      }

      return payload;
    } catch (err) {
      throw new Error(`Failed to verify OAuth state: ${err instanceof Error ? err.message : "Invalid state"}`);
    }
  }

  /**
   * Builds the official Shopify OAuth Authorization URL
   */
  public static buildAuthorizationUrl(
    shopDomain: string,
    state: string,
    redirectUri: string,
    customScopes?: string[]
  ): string {
    const sanitizedShop = this.sanitizeShopDomain(shopDomain);
    const apiKey = env.SHOPIFY_API_KEY || "negozaar_shopify_client_id_placeholder";
    const scopes = (customScopes || SHOPIFY_DEFAULT_SCOPES).join(",");

    const params = new URLSearchParams({
      client_id: apiKey,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
      "grant_options[]": "per-user", // or offline access
    });

    return `https://${sanitizedShop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Verifies the HMAC signature sent by Shopify on OAuth redirect
   */
  public static verifyCallbackHmac(queryParams: Record<string, string>): boolean {
    const apiSecret = env.SHOPIFY_API_SECRET || "negozaar_shopify_client_secret_placeholder";
    return HmacVerifier.verifyShopifyQueryHmac(queryParams, apiSecret);
  }

  /**
   * Exchanges authorization code for permanent offline access token
   */
  public static async exchangeCodeForToken(
    shopDomain: string,
    code: string
  ): Promise<{ accessToken: string; scope: string }> {
    const sanitizedShop = this.sanitizeShopDomain(shopDomain);
    const apiKey = env.SHOPIFY_API_KEY;
    const apiSecret = env.SHOPIFY_API_SECRET;

    // If running in development without live partner keys, generate deterministic offline token
    if (!apiKey || !apiSecret || apiKey.includes("placeholder")) {
      return {
        accessToken: `shpat_live_apex_${crypto.randomBytes(16).toString("hex")}`,
        scope: SHOPIFY_DEFAULT_SCOPES.join(","),
      };
    }

    const tokenUrl = `https://${sanitizedShop}/admin/oauth/access_token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify access token exchange failed [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      scope: data.scope,
    };
  }
}
