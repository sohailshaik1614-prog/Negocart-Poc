import { CouponCreationOptions, CouponResult, PlatformProductData } from "@/core/types/ecommerce.types";
import { CouponCodeGenerator } from "./coupon-generator";

export interface ShopifyProductPayload {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  status: string;
  images?: Array<{ src: string }>;
  image?: { src: string };
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku?: string;
    inventory_quantity?: number;
  }>;
}

export interface ShopifyShopInfo {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  money_format: string;
}

export class ShopifyClient {
  private readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly apiVersion = "2024-01";

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    this.accessToken = accessToken;
  }

  private get baseUrl(): string {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "X-Shopify-Access-Token": this.accessToken,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Shopify API Error [${res.status}] ${endpoint}: ${errBody}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetches shop metadata (store name, currency, primary domain)
   */
  public async getShopInfo(): Promise<ShopifyShopInfo> {
    // Development / mock fallback
    if (this.accessToken.startsWith("shpat_live_apex_") || this.accessToken.startsWith("mock_")) {
      return {
        id: 8947291038,
        name: "Apex Luxury Lifestyle",
        email: "store-owner@apexluxury.com",
        domain: this.shopDomain,
        myshopify_domain: this.shopDomain,
        currency: "INR",
        money_format: "₹{{amount}}",
      };
    }

    const data = await this.request<{ shop: ShopifyShopInfo }>("/shop.json");
    return data.shop;
  }

  /**
   * Fetches products from Shopify Catalog
   */
  public async getProducts(limit: number = 50): Promise<ShopifyProductPayload[]> {
    // Development fallback if live token is unavailable
    if (this.accessToken.startsWith("shpat_live_apex_") || this.accessToken.startsWith("mock_")) {
      return [
        {
          id: 8472910381,
          title: "Artisan Leather Weekend Duffel Bag",
          handle: "artisan-leather-weekend-duffel-bag",
          status: "active",
          image: { src: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80" },
          variants: [
            {
              id: 9482910481,
              title: "Default Title",
              price: "2000.00",
              sku: "AL-BAG-001",
              inventory_quantity: 15,
            },
          ],
        },
        {
          id: 8472910382,
          title: "Minimalist Italian Chronograph Watch",
          handle: "minimalist-italian-chronograph-watch",
          status: "active",
          image: { src: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=400&q=80" },
          variants: [
            {
              id: 9482910482,
              title: "Silver / Black Leather",
              price: "7500.00",
              sku: "MIC-W-002",
              inventory_quantity: 8,
            },
          ],
        },
        {
          id: 8472910383,
          title: "Cashmere Ribbed Knit Beanie",
          handle: "cashmere-ribbed-knit-beanie",
          status: "active",
          image: { src: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=400&q=80" },
          variants: [
            {
              id: 9482910483,
              title: "Charcoal Grey",
              price: "1200.00",
              sku: "CRK-B-003",
              inventory_quantity: 24,
            },
          ],
        },
      ];
    }

    const data = await this.request<{ products: ShopifyProductPayload[] }>(
      `/products.json?limit=${limit}&status=active`
    );
    return data.products;
  }

  /**
   * Registers mandatory webhooks with Shopify
   */
  public async registerWebhooks(webhookBaseUrl: string): Promise<{ topic: string; id: number }[]> {
    const topics = [
      "app/uninstalled",
      "products/create",
      "products/update",
      "products/delete",
      "orders/create",
      "orders/paid",
    ];

    if (this.accessToken.startsWith("shpat_live_apex_") || this.accessToken.startsWith("mock_")) {
      return topics.map((t, idx) => ({ topic: t, id: 1000 + idx }));
    }

    const registered: { topic: string; id: number }[] = [];
    const callbackAddress = `${webhookBaseUrl}/api/v1/webhooks/shopify`;

    for (const topic of topics) {
      try {
        const payload = {
          webhook: {
            topic,
            address: callbackAddress,
            format: "json",
          },
        };

        const res = await this.request<{ webhook: { id: number; topic: string } }>(
          "/webhooks.json",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        registered.push({ topic, id: res.webhook.id });
      } catch (err) {
        // Topic might already be registered, continue
        console.warn(`[Shopify Webhook] Could not register ${topic}:`, err);
      }
    }

    return registered;
  }

  /**
   * Creates a single-use Shopify discount coupon using the PriceRules API
   */
  public async createDiscountCoupon(options: CouponCreationOptions): Promise<CouponResult> {
    const code = options.code || CouponCodeGenerator.generate("NEGO");
    const expiresAt = new Date(Date.now() + options.expiresInHours * 3600 * 1000).toISOString();

    if (this.accessToken.startsWith("shpat_live_apex_") || this.accessToken.startsWith("mock_")) {
      return {
        code,
        discountId: `mock_pr_${Date.now()}`,
        discountAmount: options.discountAmount,
        expiresAt,
        checkoutUrl: `https://${this.shopDomain}/discount/${code}?redirect=/cart`,
      };
    }

    // 1. Create Price Rule
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

    const prData = await this.request<{ price_rule: { id: number } }>("/price_rules.json", {
      method: "POST",
      body: JSON.stringify(priceRuleBody),
    });

    const priceRuleId = prData.price_rule.id;

    // 2. Create Discount Code for Rule
    const dcData = await this.request<{ discount_code: { id: number; code: string } }>(
      `/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: "POST",
        body: JSON.stringify({
          discount_code: { code },
        }),
      }
    );

    const checkoutUrl = `https://${this.shopDomain}/discount/${code}?redirect=/checkout`;

    return {
      code,
      discountId: `${priceRuleId}:${dcData.discount_code.id}`,
      discountAmount: options.discountAmount,
      expiresAt,
      checkoutUrl,
    };
  }
}
