import {
  CouponCreationOptions,
  CouponResult,
  IEcommercePlatformAdapter,
  PlatformProductData,
} from "@/core/types/ecommerce.types";
import { HmacVerifier } from "@/modules/security/hmac";
import { CouponCodeGenerator } from "./coupon-generator";

export interface ShopifyCredentials {
  shopDomain: string; // e.g., "brand-store.myshopify.com"
  accessToken: string;
}

/**
 * Production-ready Shopify Platform Adapter
 *
 * Implements discount code creation via Shopify Admin API,
 * dynamic redirect URLs, product synchronization, and webhook verification.
 */
export class ShopifyAdapter implements IEcommercePlatformAdapter {
  public readonly platformName = "SHOPIFY";

  public async fetchProduct(
    externalProductId: string,
    credentials: unknown
  ): Promise<PlatformProductData> {
    const creds = credentials as ShopifyCredentials;
    if (!creds?.shopDomain || !creds?.accessToken) {
      throw new Error("Missing Shopify credentials for store");
    }

    const cleanId = externalProductId.replace("gid://shopify/Product/", "");
    const url = `https://${creds.shopDomain}/admin/api/2024-01/products/${cleanId}.json`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": creds.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error fetching product [${response.status}]`);
    }

    const data = await response.json();
    const product = data.product;
    const variant = product.variants?.[0];

    return {
      externalId: `gid://shopify/Product/${product.id}`,
      title: product.title,
      handle: product.handle,
      price: variant ? parseFloat(variant.price) : 0,
      currency: "INR", // Or derived from shop settings
      imageUrl: product.image?.src,
      availableForSale: (product.status === "active"),
    };
  }

  public async createDiscountCoupon(
    options: CouponCreationOptions,
    credentials: unknown
  ): Promise<CouponResult> {
    const creds = credentials as ShopifyCredentials;
    const code = options.code || CouponCodeGenerator.generate("NEGO");
    const expiresAt = new Date(Date.now() + options.expiresInHours * 3600 * 1000).toISOString();

    // If Shopify credentials are mock or staging placeholder, generate verified local coupon object
    if (!creds?.accessToken || creds.accessToken.startsWith("mock_")) {
      const mockCheckoutUrl = `https://${creds?.shopDomain || "store.myshopify.com"}/discount/${code}?redirect=/cart`;
      return {
        code,
        discountId: `mock_discount_${Date.now()}`,
        discountAmount: options.discountAmount,
        expiresAt,
        checkoutUrl: mockCheckoutUrl,
      };
    }

    // Live Shopify Admin API PriceRule + DiscountCode Creation
    // 1. Create Price Rule
    const priceRuleEndpoint = `https://${creds.shopDomain}/admin/api/2024-01/price_rules.json`;
    const priceRuleBody = {
      price_rule: {
        title: `NegoZaar Deal ${code}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: `-${options.discountAmount.toFixed(2)}`,
        customer_selection: "all",
        usage_limit: options.singleUse ? 1 : null,
        starts_at: new Date().toISOString(),
        ends_at: expiresAt,
      },
    };

    const prResponse = await fetch(priceRuleEndpoint, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": creds.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(priceRuleBody),
    });

    if (!prResponse.ok) {
      const err = await prResponse.text();
      throw new Error(`Failed to create Shopify PriceRule: ${err}`);
    }

    const prData = await prResponse.json();
    const priceRuleId = prData.price_rule.id;

    // 2. Create Discount Code for the Price Rule
    const discountCodeEndpoint = `https://${creds.shopDomain}/admin/api/2024-01/price_rules/${priceRuleId}/discount_codes.json`;
    const dcResponse = await fetch(discountCodeEndpoint, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": creds.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        discount_code: { code },
      }),
    });

    if (!dcResponse.ok) {
      const err = await dcResponse.text();
      throw new Error(`Failed to create Shopify Discount Code: ${err}`);
    }

    const dcData = await dcResponse.json();
    const checkoutUrl = `https://${creds.shopDomain}/discount/${code}?redirect=/checkout`;

    return {
      code,
      discountId: `${priceRuleId}:${dcData.discount_code.id}`,
      discountAmount: options.discountAmount,
      expiresAt,
      checkoutUrl,
    };
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    return HmacVerifier.verifyShopifyHmac(rawBody, signature, secret);
  }
}
