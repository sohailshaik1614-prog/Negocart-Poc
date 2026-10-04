export interface CouponCreationOptions {
  storeId: string;
  code: string;
  discountAmount: number;
  originalPrice: number;
  negotiatedPrice: number;
  currency: string;
  productId: string;
  expiresInHours: number;
  singleUse: boolean;
}

export interface CouponResult {
  code: string;
  discountId: string;
  discountAmount: number;
  expiresAt: string;
  checkoutUrl?: string;
}

export interface PlatformProductData {
  externalId: string;
  title: string;
  handle: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availableForSale: boolean;
}

export interface IEcommercePlatformAdapter {
  readonly platformName: string;
  
  /**
   * Validates that the product exists and retrieves live price
   */
  fetchProduct(externalProductId: string, storeCredentials: unknown): Promise<PlatformProductData>;
  
  /**
   * Generates a platform-native discount or draft order coupon
   */
  createDiscountCoupon(options: CouponCreationOptions, storeCredentials: unknown): Promise<CouponResult>;
  
  /**
   * Verifies the authenticity of incoming webhooks (e.g. HMAC SHA256)
   */
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
}
