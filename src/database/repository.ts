import crypto from "crypto";
import { ProductNegotiationSettings } from "@/core/types/rule.types";
import {
  Product,
  ProductWithNegotiationSettings,
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilterParams,
} from "@/core/types/product.types";
import { Store } from "@/core/types/store.types";
import { Merchant, User, UserRole } from "@/core/types/tenant.types";
import {
  NegotiationMessage,
  NegotiationOffer,
  NegotiationSession,
  SessionStatus,
} from "@/core/types/negotiation.types";
import { AnalyticsEvent } from "@/core/types/analytics.types";
import { getSupabaseAdminClient } from "./supabase-client";
import { env } from "@/config/env";
import { PasswordService } from "@/modules/auth/password-service";

export interface TransactionRecord {
  id: string;
  sessionId: string;
  storeId: string;
  discountCode: string;
  claimToken: string;
  status: "GENERATED" | "CLAIMED" | "EXPIRED" | "REVOKED";
  originalPrice: number;
  negotiatedPrice: number;
  discountAmount: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Data Access Layer / Repository
 *
 * Implements Supabase DB access with seamless fallback to high-fidelity
 * in-memory storage when testing locally or running without live credentials.
 * Enforces real relational integrity, unique constraints, and tenant boundaries.
 */
export class NegoZaarRepository {
  private static isUsingMockDb(): boolean {
    return (
      !env.NEXT_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    );
  }

  // Precomputed default test hash for "Password123!"
  private static readonly DEFAULT_TEST_PASSWORD_HASH = PasswordService.hashPassword("Password123!");

  // ============================================================================
  // IN-MEMORY DATA STORE (For local dev, test suites, and offline resilience)
  // ============================================================================
  private static merchants: Map<string, Merchant> = new Map([
    [
      "a0000000-0000-0000-0000-000000000001",
      {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "Apex Retail Brands",
        slug: "apex-retail",
        billingEmail: "admin@apexretail.test",
        tier: "GROWTH",
        status: "ACTIVE",
        maxStores: 3,
        settings: {
          defaultMaxRounds: 3,
          defaultStrategy: "MODERATE",
          defaultMaxDiscountPercentage: 25,
          notificationEmail: "alerts@apexretail.test",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  private static users: Map<string, User> = new Map([
    [
      "b0000000-0000-0000-0000-000000000001",
      {
        id: "b0000000-0000-0000-0000-000000000001",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        email: "merchant@apexretail.test",
        fullName: "Priya Sharma",
        passwordHash: NegoZaarRepository.DEFAULT_TEST_PASSWORD_HASH,
        role: "OWNER",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  private static stores: Map<string, Store> = new Map([
    [
      "d0000000-0000-0000-0000-000000000001",
      {
        id: "d0000000-0000-0000-0000-000000000001",
        merchantId: "a0000000-0000-0000-0000-000000000001",
        platform: "SHOPIFY",
        platformStoreId: "apex-luxury.myshopify.com",
        storeName: "Apex Luxury Lifestyle",
        publicStoreKey: "pub_live_apex_9a8b7c6d5e4f3a2b1c",
        currency: "INR",
        status: "ACTIVE",
        settings: {
          brandColor: "#16a34a",
          widgetTheme: "auto",
          position: "bottom-right",
          requireEmailToClaim: false,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  private static products: Map<string, Product> = new Map([
    [
      "e0000000-0000-0000-0000-000000000001",
      {
        id: "e0000000-0000-0000-0000-000000000001",
        storeId: "d0000000-0000-0000-0000-000000000001",
        externalProductId: "gid://shopify/Product/8472910381",
        title: "Artisan Leather Weekend Duffel Bag",
        handle: "artisan-leather-weekend-duffel-bag",
        sku: "AL-BAG-001",
        originalPrice: 2000.0,
        currency: "INR",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
        inventoryQuantity: 15,
        isActive: true,
        syncedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  private static rules: Map<string, ProductNegotiationSettings> = new Map([
    [
      "e0000000-0000-0000-0000-000000000001",
      {
        id: "f0000000-0000-0000-0000-000000000001",
        storeId: "d0000000-0000-0000-0000-000000000001",
        productId: "e0000000-0000-0000-0000-000000000001",
        isNegotiationEnabled: true,
        minAcceptablePrice: 1500.0, // Floor price: ₹1,500
        maxDiscountPercentage: 25.0,
        autoAcceptPrice: 1850.0,
        maxNegotiationRounds: 3,
        strategy: "MODERATE",
        minOrderQuantity: 1,
        couponValidityHours: 24,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  private static sessions: Map<string, NegotiationSession> = new Map();
  private static messages: Map<string, NegotiationMessage[]> = new Map();
  private static offers: Map<string, NegotiationOffer[]> = new Map();
  private static transactions: Map<string, TransactionRecord> = new Map();
  private static analytics: AnalyticsEvent[] = [];

  // ============================================================================
  // AUTHENTICATION & USERS
  // ============================================================================

  public static async createUser(data: {
    merchantId: string;
    email: string;
    fullName: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<User> {
    const emailNorm = data.email.toLowerCase().trim();
    if (this.isUsingMockDb()) {
      for (const u of this.users.values()) {
        if (u.email.toLowerCase() === emailNorm) {
          throw new Error("A user with this email address already exists");
        }
      }

      const id = crypto.randomUUID();
      const user: User = {
        id,
        merchantId: data.merchantId,
        email: emailNorm,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        role: data.role || "OWNER",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.set(id, user);
      return user;
    }

    const supabase = getSupabaseAdminClient();
    const { data: user, error } = await supabase
      .from("users")
      .insert({
        merchant_id: data.merchantId,
        email: emailNorm,
        full_name: data.fullName,
        password_hash: data.passwordHash,
        role: data.role || "OWNER",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return user as User;
  }

  public static async getUserByEmail(email: string): Promise<User | null> {
    const emailNorm = email.toLowerCase().trim();
    if (this.isUsingMockDb()) {
      for (const u of this.users.values()) {
        if (u.email.toLowerCase() === emailNorm) return u;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", emailNorm)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      merchantId: data.merchant_id,
      email: data.email,
      fullName: data.full_name,
      passwordHash: data.password_hash,
      role: data.role,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async getUserById(userId: string): Promise<User | null> {
    if (this.isUsingMockDb()) {
      return this.users.get(userId) || null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      merchantId: data.merchant_id,
      email: data.email,
      fullName: data.full_name,
      passwordHash: data.password_hash,
      role: data.role,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ============================================================================
  // MERCHANT MANAGEMENT
  // ============================================================================

  public static async createMerchant(data: {
    name: string;
    slug?: string;
    billingEmail: string;
    tier?: Merchant["tier"];
    settings?: Merchant["settings"];
  }): Promise<Merchant> {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const id = crypto.randomUUID();

    if (this.isUsingMockDb()) {
      const merchant: Merchant = {
        id,
        name: data.name,
        slug,
        billingEmail: data.billingEmail.toLowerCase().trim(),
        tier: data.tier || "STARTER",
        status: "ACTIVE",
        maxStores: 1,
        settings: data.settings || {
          defaultMaxRounds: 3,
          defaultStrategy: "MODERATE",
          defaultMaxDiscountPercentage: 25,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.merchants.set(id, merchant);
      return merchant;
    }

    const supabase = getSupabaseAdminClient();
    const { data: created, error } = await supabase
      .from("merchants")
      .insert({
        id,
        name: data.name,
        slug,
        billing_email: data.billingEmail.toLowerCase().trim(),
        tier: data.tier || "STARTER",
        status: "ACTIVE",
        settings: data.settings || {},
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created as Merchant;
  }

  public static async getMerchantById(merchantId: string): Promise<Merchant | null> {
    if (this.isUsingMockDb()) {
      return this.merchants.get(merchantId) || null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("merchants").select("*").eq("id", merchantId).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      billingEmail: data.billing_email,
      tier: data.tier,
      status: data.status,
      maxStores: data.max_stores,
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async updateMerchant(
    merchantId: string,
    updates: Partial<Omit<Merchant, "id" | "createdAt" | "updatedAt">>
  ): Promise<Merchant> {
    if (this.isUsingMockDb()) {
      const existing = this.merchants.get(merchantId);
      if (!existing) throw new Error("Merchant not found");

      const updated: Merchant = {
        ...existing,
        ...updates,
        settings: updates.settings ? { ...existing.settings, ...updates.settings } : existing.settings,
        updatedAt: new Date().toISOString(),
      };
      this.merchants.set(merchantId, updated);
      return updated;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("merchants")
      .update({
        ...updates,
        billing_email: updates.billingEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", merchantId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Merchant;
  }

  // ============================================================================
  // STORE MANAGEMENT
  // ============================================================================

  public static async createStore(data: {
    merchantId: string;
    platform?: Store["platform"];
    platformStoreId: string;
    storeName: string;
    currency?: string;
    settings?: Store["settings"];
  }): Promise<Store> {
    const id = crypto.randomUUID();
    const publicStoreKey = `pub_live_${crypto.randomBytes(16).toString("hex")}`;

    if (this.isUsingMockDb()) {
      const store: Store = {
        id,
        merchantId: data.merchantId,
        platform: data.platform || "SHOPIFY",
        platformStoreId: data.platformStoreId,
        storeName: data.storeName,
        publicStoreKey,
        currency: data.currency || "INR",
        status: "ACTIVE",
        settings: data.settings || {
          brandColor: "#16a34a",
          widgetTheme: "auto",
          position: "bottom-right",
          requireEmailToClaim: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.stores.set(id, store);
      return store;
    }

    const supabase = getSupabaseAdminClient();
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        id,
        merchant_id: data.merchantId,
        platform: data.platform || "SHOPIFY",
        platform_store_id: data.platformStoreId,
        store_name: data.storeName,
        public_store_key: publicStoreKey,
        currency: data.currency || "INR",
        status: "ACTIVE",
        settings: data.settings || {},
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created as Store;
  }

  public static async getStoreById(storeId: string): Promise<Store | null> {
    if (this.isUsingMockDb()) {
      return this.stores.get(storeId) || null;
    }
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      merchantId: data.merchant_id,
      platform: data.platform,
      platformStoreId: data.platform_store_id,
      storeName: data.store_name,
      publicStoreKey: data.public_store_key,
      currency: data.currency,
      status: data.status,
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async getStoreByPublicKey(key: string): Promise<Store | null> {
    if (this.isUsingMockDb()) {
      for (const store of this.stores.values()) {
        if (store.publicStoreKey === key) return store;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("public_store_key", key)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      merchantId: data.merchant_id,
      platform: data.platform,
      platformStoreId: data.platform_store_id,
      storeName: data.store_name,
      publicStoreKey: data.public_store_key,
      currency: data.currency,
      status: data.status,
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async getStoresForMerchant(merchantId: string): Promise<Store[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.stores.values()).filter((s) => s.merchantId === merchantId);
    }
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from("stores").select("*").eq("merchant_id", merchantId);
    return ((data || []) as Store[]).map((d: any) => ({
      id: d.id,
      merchantId: d.merchant_id,
      platform: d.platform,
      platformStoreId: d.platform_store_id,
      storeName: d.store_name,
      publicStoreKey: d.public_store_key,
      currency: d.currency,
      status: d.status,
      settings: d.settings || {},
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  public static async updateStore(
    storeId: string,
    updates: Partial<Omit<Store, "id" | "merchantId" | "publicStoreKey" | "createdAt" | "updatedAt">>
  ): Promise<Store> {
    if (this.isUsingMockDb()) {
      const existing = this.stores.get(storeId);
      if (!existing) throw new Error("Store not found");

      const updated: Store = {
        ...existing,
        ...updates,
        settings: updates.settings ? { ...existing.settings, ...updates.settings } : existing.settings,
        updatedAt: new Date().toISOString(),
      };
      this.stores.set(storeId, updated);
      return updated;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .update({
        platform_store_id: updates.platformStoreId,
        store_name: updates.storeName,
        currency: updates.currency,
        status: updates.status,
        settings: updates.settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Store;
  }

  // ============================================================================
  // PRODUCT MANAGEMENT (CRUD + NEGOTIATION CONFIGURATION)
  // ============================================================================

  public static async createProduct(dto: CreateProductDTO): Promise<ProductWithNegotiationSettings> {
    const store = await this.getStoreById(dto.storeId);
    if (!store) throw new Error("Store not found");

    if (dto.originalPrice <= 0) {
      throw new Error("Original price must be greater than zero");
    }

    if (dto.minAcceptablePrice > dto.originalPrice) {
      throw new Error("Minimum acceptable price cannot exceed the original price");
    }

    if (dto.minAcceptablePrice <= 0) {
      throw new Error("Minimum acceptable price must be greater than zero");
    }

    const productId = crypto.randomUUID();
    const ruleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const maxDiscountPct =
      dto.maxDiscountPercentage !== undefined
        ? dto.maxDiscountPercentage
        : Number((((dto.originalPrice - dto.minAcceptablePrice) / dto.originalPrice) * 100).toFixed(2));

    const product: Product = {
      id: productId,
      storeId: dto.storeId,
      externalProductId: dto.externalProductId || `prod_${crypto.randomBytes(8).toString("hex")}`,
      title: dto.title,
      handle: dto.handle || dto.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sku: dto.sku,
      originalPrice: dto.originalPrice,
      currency: dto.currency || store.currency,
      imageUrl: dto.imageUrl,
      inventoryQuantity: dto.inventoryQuantity !== undefined ? dto.inventoryQuantity : 1,
      isActive: true,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const rules: ProductNegotiationSettings = {
      id: ruleId,
      storeId: dto.storeId,
      productId: productId,
      isNegotiationEnabled: dto.isNegotiationEnabled !== undefined ? dto.isNegotiationEnabled : true,
      minAcceptablePrice: dto.minAcceptablePrice,
      maxDiscountPercentage: maxDiscountPct,
      autoAcceptPrice: dto.autoAcceptPrice,
      maxNegotiationRounds: dto.maxNegotiationRounds || 3,
      strategy: dto.strategy || "MODERATE",
      minOrderQuantity: dto.minOrderQuantity || 1,
      couponValidityHours: dto.couponValidityHours || 24,
      customSystemPromptAddon: dto.customSystemPromptAddon,
      createdAt: now,
      updatedAt: now,
    };

    if (this.isUsingMockDb()) {
      this.products.set(productId, product);
      this.rules.set(productId, rules);
      return { ...product, negotiationSettings: rules };
    }

    const supabase = getSupabaseAdminClient();
    const { error: pError } = await supabase.from("products").insert({
      id: product.id,
      store_id: product.storeId,
      external_product_id: product.externalProductId,
      title: product.title,
      handle: product.handle,
      sku: product.sku,
      original_price: product.originalPrice,
      currency: product.currency,
      image_url: product.imageUrl,
      inventory_quantity: product.inventoryQuantity,
      is_active: product.isActive,
    });
    if (pError) throw new Error(pError.message);

    const { error: rError } = await supabase.from("product_negotiation_settings").insert({
      id: rules.id,
      store_id: rules.storeId,
      product_id: rules.productId,
      is_negotiation_enabled: rules.isNegotiationEnabled,
      min_acceptable_price: rules.minAcceptablePrice,
      max_discount_percentage: rules.maxDiscountPercentage,
      auto_accept_price: rules.autoAcceptPrice,
      max_negotiation_rounds: rules.maxNegotiationRounds,
      strategy: rules.strategy,
      min_order_quantity: rules.minOrderQuantity,
      coupon_validity_hours: rules.couponValidityHours,
      custom_system_prompt_addon: rules.customSystemPromptAddon,
    });
    if (rError) throw new Error(rError.message);

    return { ...product, negotiationSettings: rules };
  }

  public static async getProductById(productId: string): Promise<Product | null> {
    if (this.isUsingMockDb()) {
      return this.products.get(productId) || null;
    }
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      storeId: data.store_id,
      externalProductId: data.external_product_id,
      title: data.title,
      handle: data.handle,
      sku: data.sku,
      originalPrice: parseFloat(data.original_price),
      currency: data.currency,
      imageUrl: data.image_url,
      inventoryQuantity: data.inventory_quantity,
      isActive: data.is_active,
      syncedAt: data.synced_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async getProductWithRules(productId: string): Promise<ProductWithNegotiationSettings | null> {
    const product = await this.getProductById(productId);
    if (!product) return null;

    const negotiationSettings = await this.getProductRule(product.storeId, product.id);
    return {
      ...product,
      negotiationSettings,
    };
  }

  public static async updateProduct(
    productId: string,
    dto: UpdateProductDTO
  ): Promise<ProductWithNegotiationSettings> {
    const existing = await this.getProductById(productId);
    if (!existing) throw new Error("Product not found");

    const newOriginalPrice = dto.originalPrice !== undefined ? dto.originalPrice : existing.originalPrice;
    if (newOriginalPrice <= 0) {
      throw new Error("Original price must be positive");
    }

    const existingRule = await this.getProductRule(existing.storeId, productId);
    const newFloorPrice =
      dto.minAcceptablePrice !== undefined
        ? dto.minAcceptablePrice
        : existingRule?.minAcceptablePrice || newOriginalPrice;

    if (newFloorPrice > newOriginalPrice) {
      throw new Error("Minimum acceptable price cannot exceed the original price");
    }
    if (newFloorPrice <= 0) {
      throw new Error("Minimum acceptable price must be positive");
    }

    const now = new Date().toISOString();

    const updatedProduct: Product = {
      ...existing,
      title: dto.title !== undefined ? dto.title : existing.title,
      originalPrice: newOriginalPrice,
      currency: dto.currency !== undefined ? dto.currency : existing.currency,
      sku: dto.sku !== undefined ? dto.sku : existing.sku,
      handle: dto.handle !== undefined ? dto.handle : existing.handle,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : existing.imageUrl,
      inventoryQuantity: dto.inventoryQuantity !== undefined ? dto.inventoryQuantity : existing.inventoryQuantity,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      updatedAt: now,
    };

    let updatedRule: ProductNegotiationSettings | null = null;
    if (existingRule || dto.minAcceptablePrice !== undefined) {
      const maxDiscount =
        dto.maxDiscountPercentage !== undefined
          ? dto.maxDiscountPercentage
          : existingRule?.maxDiscountPercentage ||
            Number((((newOriginalPrice - newFloorPrice) / newOriginalPrice) * 100).toFixed(2));

      updatedRule = {
        id: existingRule?.id || crypto.randomUUID(),
        storeId: existing.storeId,
        productId,
        isNegotiationEnabled:
          dto.isNegotiationEnabled !== undefined
            ? dto.isNegotiationEnabled
            : existingRule?.isNegotiationEnabled ?? true,
        minAcceptablePrice: newFloorPrice,
        maxDiscountPercentage: maxDiscount,
        autoAcceptPrice: dto.autoAcceptPrice !== undefined ? dto.autoAcceptPrice : existingRule?.autoAcceptPrice,
        maxNegotiationRounds: dto.maxNegotiationRounds || existingRule?.maxNegotiationRounds || 3,
        strategy: dto.strategy || existingRule?.strategy || "MODERATE",
        minOrderQuantity: dto.minOrderQuantity || existingRule?.minOrderQuantity || 1,
        couponValidityHours: dto.couponValidityHours || existingRule?.couponValidityHours || 24,
        customSystemPromptAddon:
          dto.customSystemPromptAddon !== undefined
            ? dto.customSystemPromptAddon
            : existingRule?.customSystemPromptAddon,
        createdAt: existingRule?.createdAt || now,
        updatedAt: now,
      };
    }

    if (this.isUsingMockDb()) {
      this.products.set(productId, updatedProduct);
      if (updatedRule) {
        this.rules.set(productId, updatedRule);
      }
      return { ...updatedProduct, negotiationSettings: updatedRule };
    }

    const supabase = getSupabaseAdminClient();
    const { error: pError } = await supabase
      .from("products")
      .update({
        title: updatedProduct.title,
        original_price: updatedProduct.originalPrice,
        currency: updatedProduct.currency,
        sku: updatedProduct.sku,
        handle: updatedProduct.handle,
        image_url: updatedProduct.imageUrl,
        inventory_quantity: updatedProduct.inventoryQuantity,
        is_active: updatedProduct.isActive,
        updated_at: now,
      })
      .eq("id", productId);

    if (pError) throw new Error(pError.message);

    if (updatedRule) {
      const { error: rError } = await supabase.from("product_negotiation_settings").upsert({
        id: updatedRule.id,
        store_id: updatedRule.storeId,
        product_id: updatedRule.productId,
        is_negotiation_enabled: updatedRule.isNegotiationEnabled,
        min_acceptable_price: updatedRule.minAcceptablePrice,
        max_discount_percentage: updatedRule.maxDiscountPercentage,
        auto_accept_price: updatedRule.autoAcceptPrice,
        max_negotiation_rounds: updatedRule.maxNegotiationRounds,
        strategy: updatedRule.strategy,
        min_order_quantity: updatedRule.minOrderQuantity,
        coupon_validity_hours: updatedRule.couponValidityHours,
        custom_system_prompt_addon: updatedRule.customSystemPromptAddon,
        updated_at: now,
      });
      if (rError) throw new Error(rError.message);
    }

    return { ...updatedProduct, negotiationSettings: updatedRule };
  }

  public static async deleteProduct(productId: string): Promise<boolean> {
    if (this.isUsingMockDb()) {
      const existed = this.products.delete(productId);
      this.rules.delete(productId);
      return existed;
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw new Error(error.message);
    return true;
  }

  public static async getProductsForStore(
    storeId: string,
    filter?: ProductFilterParams
  ): Promise<ProductWithNegotiationSettings[]> {
    let prods: Product[] = [];

    if (this.isUsingMockDb()) {
      prods = Array.from(this.products.values()).filter((p) => p.storeId === storeId);
    } else {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase.from("products").select("*").eq("store_id", storeId);
      prods = (data || []).map((d: any) => ({
        id: d.id,
        storeId: d.store_id,
        externalProductId: d.external_product_id,
        title: d.title,
        handle: d.handle,
        sku: d.sku,
        originalPrice: parseFloat(d.original_price),
        currency: d.currency,
        imageUrl: d.image_url,
        inventoryQuantity: d.inventory_quantity,
        isActive: d.is_active,
        syncedAt: d.synced_at,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    }

    // Apply filtering
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      prods = prods.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
      );
    }
    if (filter?.isActive !== undefined) {
      prods = prods.filter((p) => p.isActive === filter.isActive);
    }

    // Attach negotiation settings
    const result: ProductWithNegotiationSettings[] = [];
    for (const p of prods) {
      const rule = await this.getProductRule(storeId, p.id);
      if (filter?.isNegotiationEnabled !== undefined && rule) {
        if (rule.isNegotiationEnabled !== filter.isNegotiationEnabled) continue;
      }
      result.push({
        ...p,
        negotiationSettings: rule,
      });
    }

    return result;
  }

  public static async getProductRule(
    storeId: string,
    productId?: string
  ): Promise<ProductNegotiationSettings | null> {
    if (this.isUsingMockDb()) {
      if (productId && this.rules.has(productId)) {
        return this.rules.get(productId)!;
      }
      for (const rule of this.rules.values()) {
        if (rule.storeId === storeId && !rule.productId) return rule;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    if (productId) {
      const { data } = await supabase
        .from("product_negotiation_settings")
        .select("*")
        .eq("store_id", storeId)
        .eq("product_id", productId)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          storeId: data.store_id,
          productId: data.product_id,
          isNegotiationEnabled: data.is_negotiation_enabled,
          minAcceptablePrice: parseFloat(data.min_acceptable_price),
          maxDiscountPercentage: parseFloat(data.max_discount_percentage),
          autoAcceptPrice: data.auto_accept_price ? parseFloat(data.auto_accept_price) : undefined,
          maxNegotiationRounds: data.max_negotiation_rounds,
          strategy: data.strategy,
          minOrderQuantity: data.min_order_quantity,
          couponValidityHours: data.coupon_validity_hours,
          customSystemPromptAddon: data.custom_system_prompt_addon,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    }

    const { data: storeRule } = await supabase
      .from("product_negotiation_settings")
      .select("*")
      .eq("store_id", storeId)
      .is("product_id", null)
      .maybeSingle();

    if (!storeRule) return null;
    return {
      id: storeRule.id,
      storeId: storeRule.store_id,
      productId: storeRule.product_id,
      isNegotiationEnabled: storeRule.is_negotiation_enabled,
      minAcceptablePrice: parseFloat(storeRule.min_acceptable_price),
      maxDiscountPercentage: parseFloat(storeRule.max_discount_percentage),
      autoAcceptPrice: storeRule.auto_accept_price ? parseFloat(storeRule.auto_accept_price) : undefined,
      maxNegotiationRounds: storeRule.max_negotiation_rounds,
      strategy: storeRule.strategy,
      minOrderQuantity: storeRule.min_order_quantity,
      couponValidityHours: storeRule.coupon_validity_hours,
      customSystemPromptAddon: storeRule.custom_system_prompt_addon,
      createdAt: storeRule.created_at,
      updatedAt: storeRule.updated_at,
    };
  }

  public static async upsertProductRule(rule: ProductNegotiationSettings): Promise<void> {
    if (this.isUsingMockDb()) {
      if (rule.productId) {
        this.rules.set(rule.productId, rule);
      } else {
        this.rules.set(`store_${rule.storeId}`, rule);
      }
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("product_negotiation_settings").upsert({
      id: rule.id,
      store_id: rule.storeId,
      product_id: rule.productId,
      is_negotiation_enabled: rule.isNegotiationEnabled,
      min_acceptable_price: rule.minAcceptablePrice,
      max_discount_percentage: rule.maxDiscountPercentage,
      auto_accept_price: rule.autoAcceptPrice,
      max_negotiation_rounds: rule.maxNegotiationRounds,
      strategy: rule.strategy,
      min_order_quantity: rule.minOrderQuantity,
      coupon_validity_hours: rule.couponValidityHours,
      custom_system_prompt_addon: rule.customSystemPromptAddon,
      updated_at: new Date().toISOString(),
    });
  }

  // ============================================================================
  // NEGOTIATION SESSIONS & MESSAGES
  // ============================================================================

  public static async createNegotiationSession(session: NegotiationSession): Promise<NegotiationSession> {
    if (this.isUsingMockDb()) {
      this.sessions.set(session.id, session);
      this.messages.set(session.id, []);
      this.offers.set(session.id, []);
      return session;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("negotiation_sessions")
      .insert({
        id: session.id,
        merchant_id: session.merchantId,
        store_id: session.storeId,
        product_id: session.productId,
        cart_reference: session.cartReference,
        customer_id: session.customerId,
        session_token_hash: session.sessionTokenHash,
        status: session.status,
        current_round: session.currentRound,
        attempt_number: session.attemptNumber,
        max_rounds: session.maxRounds,
        original_price: session.originalPrice,
        current_offer: session.currentOffer,
        initial_customer_offer: session.initialCustomerOffer,
        final_agreed_price: session.finalAgreedPrice,
        currency: session.currency,
        expires_at: session.expiresAt,
        metadata: session.metadata,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as NegotiationSession;
  }

  public static async getSessionById(sessionId: string): Promise<NegotiationSession | null> {
    if (this.isUsingMockDb()) {
      return this.sessions.get(sessionId) || null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      merchantId: data.merchant_id,
      storeId: data.store_id,
      productId: data.product_id,
      cartReference: data.cart_reference,
      customerId: data.customer_id,
      sessionTokenHash: data.session_token_hash,
      status: data.status,
      currentRound: data.current_round,
      attemptNumber: data.attempt_number || data.current_round,
      maxRounds: data.max_rounds,
      maxAttempts: data.max_rounds,
      originalPrice: parseFloat(data.original_price),
      currentOffer: data.current_offer ? parseFloat(data.current_offer) : undefined,
      initialCustomerOffer: data.initial_customer_offer ? parseFloat(data.initial_customer_offer) : undefined,
      finalAgreedPrice: data.final_agreed_price ? parseFloat(data.final_agreed_price) : undefined,
      currency: data.currency,
      expiresAt: data.expires_at,
      closedAt: data.closed_at,
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    finalAgreedPrice?: number
  ): Promise<void> {
    const now = new Date().toISOString();
    if (this.isUsingMockDb()) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = status;
        if (finalAgreedPrice !== undefined) {
          session.finalAgreedPrice = finalAgreedPrice;
          session.currentOffer = finalAgreedPrice;
        }
        if (["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(status)) {
          session.closedAt = now;
        }
        session.updatedAt = now;
      }
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase
      .from("negotiation_sessions")
      .update({
        status,
        final_agreed_price: finalAgreedPrice,
        current_offer: finalAgreedPrice,
        closed_at: ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(status) ? now : null,
        updated_at: now,
      })
      .eq("id", sessionId);
  }

  public static async updateSessionOffer(
    sessionId: string,
    currentOffer: number,
    status?: SessionStatus
  ): Promise<void> {
    const now = new Date().toISOString();
    if (this.isUsingMockDb()) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.currentOffer = currentOffer;
        if (status) session.status = status;
        session.updatedAt = now;
      }
      return;
    }

    const supabase = getSupabaseAdminClient();
    const updatePayload: Record<string, unknown> = {
      current_offer: currentOffer,
      updated_at: now,
    };
    if (status) updatePayload.status = status;
    await supabase.from("negotiation_sessions").update(updatePayload).eq("id", sessionId);
  }

  public static async incrementSessionAttempt(sessionId: string): Promise<number> {
    if (this.isUsingMockDb()) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.attemptNumber += 1;
        session.currentRound = session.attemptNumber;
        session.updatedAt = new Date().toISOString();
        return session.attemptNumber;
      }
      return 1;
    }

    const session = await this.getSessionById(sessionId);
    const newAttempt = (session?.attemptNumber ?? 0) + 1;
    const supabase = getSupabaseAdminClient();
    await supabase
      .from("negotiation_sessions")
      .update({
        attempt_number: newAttempt,
        current_round: newAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    return newAttempt;
  }

  public static async addMessage(message: NegotiationMessage): Promise<void> {
    if (this.isUsingMockDb()) {
      const list = this.messages.get(message.sessionId) || [];
      list.push(message);
      this.messages.set(message.sessionId, list);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("negotiation_messages").insert({
      id: message.id,
      session_id: message.sessionId,
      sender_role: message.senderRole,
      message_text: message.messageText,
      round_number: message.roundNumber,
      attempt_number: message.attemptNumber,
      customer_message: message.customerMessage,
      ai_response: message.aiResponse,
      associated_offer: message.associatedOffer,
      raw_ai_reasoning: message.rawAiReasoning,
      created_at: message.createdAt,
    });
  }

  public static async getSessionMessages(sessionId: string): Promise<NegotiationMessage[]> {
    if (this.isUsingMockDb()) {
      return this.messages.get(sessionId) || [];
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return ((data || []) as any[]).map((d) => ({
      id: d.id,
      sessionId: d.session_id,
      senderRole: d.sender_role,
      messageText: d.message_text,
      roundNumber: d.round_number,
      attemptNumber: d.attempt_number || d.round_number,
      customerMessage: d.customer_message,
      aiResponse: d.ai_response,
      associatedOffer: d.associated_offer ? parseFloat(d.associated_offer) : undefined,
      rawAiReasoning: d.raw_ai_reasoning,
      createdAt: d.created_at,
    }));
  }

  public static async addOffer(offer: NegotiationOffer): Promise<void> {
    if (this.isUsingMockDb()) {
      const list = this.offers.get(offer.sessionId) || [];
      list.push(offer);
      this.offers.set(offer.sessionId, list);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("negotiation_offers").insert({
      id: offer.id,
      session_id: offer.sessionId,
      round_number: offer.roundNumber,
      attempt_number: offer.attemptNumber,
      proposed_by: offer.proposedBy,
      amount: offer.amount,
      currency: offer.currency,
      discount_percentage: offer.discountPercentage,
      guardrail_status: offer.guardrailStatus,
      guardrail_notes: offer.guardrailNotes,
      created_at: offer.createdAt,
    });
  }

  public static async getSessionOffers(sessionId: string): Promise<NegotiationOffer[]> {
    if (this.isUsingMockDb()) {
      return this.offers.get(sessionId) || [];
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_offers")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return ((data || []) as any[]).map((d) => ({
      id: d.id,
      sessionId: d.session_id,
      roundNumber: d.round_number,
      attemptNumber: d.attempt_number || d.round_number,
      proposedBy: d.proposed_by,
      amount: parseFloat(d.amount),
      currency: d.currency,
      discountPercentage: parseFloat(d.discount_percentage),
      guardrailStatus: d.guardrail_status,
      guardrailNotes: d.guardrail_notes,
      createdAt: d.created_at,
    }));
  }

  // ============================================================================
  // TRANSACTIONS, CLAIMS & ANALYTICS
  // ============================================================================

  public static async createTransaction(tx: TransactionRecord): Promise<TransactionRecord> {
    if (this.isUsingMockDb()) {
      this.transactions.set(tx.id, tx);
      return tx;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("transactions").insert(tx).select().single();
    if (error) throw new Error(error.message);
    return data as TransactionRecord;
  }

  public static async getTransactionBySessionId(sessionId: string): Promise<TransactionRecord | null> {
    if (this.isUsingMockDb()) {
      for (const tx of this.transactions.values()) {
        if (tx.sessionId === sessionId) return tx;
      }
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) return null;
    return data as TransactionRecord | null;
  }

  public static async recordAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    if (this.isUsingMockDb()) {
      this.analytics.push(event);
      return;
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("analytics_events").insert({
      id: event.id,
      store_id: event.storeId,
      session_id: event.sessionId,
      event_type: event.eventType,
      properties: event.properties,
      ip_hash: event.ipHash,
      occurred_at: event.occurredAt,
    });
  }

  public static async getRecentSessions(
    storeId: string,
    limit: number = 20
  ): Promise<NegotiationSession[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.sessions.values())
        .filter((s) => s.storeId === storeId)
        .slice(-limit)
        .reverse();
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((data || []) as any[]).map((d) => ({
      id: d.id,
      merchantId: d.merchant_id,
      storeId: d.store_id,
      productId: d.product_id,
      cartReference: d.cart_reference,
      customerId: d.customer_id,
      sessionTokenHash: d.session_token_hash,
      status: d.status,
      currentRound: d.current_round,
      attemptNumber: d.attempt_number || d.current_round,
      maxRounds: d.max_rounds,
      maxAttempts: d.max_rounds,
      originalPrice: parseFloat(d.original_price),
      currentOffer: d.current_offer ? parseFloat(d.current_offer) : undefined,
      initialCustomerOffer: d.initial_customer_offer ? parseFloat(d.initial_customer_offer) : undefined,
      finalAgreedPrice: d.final_agreed_price ? parseFloat(d.final_agreed_price) : undefined,
      currency: d.currency,
      expiresAt: d.expires_at,
      closedAt: d.closed_at,
      metadata: d.metadata || {},
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  public static async getSessionsForMerchant(
    merchantId: string,
    limit: number = 50
  ): Promise<NegotiationSession[]> {
    if (this.isUsingMockDb()) {
      return Array.from(this.sessions.values())
        .filter((s) => s.merchantId === merchantId)
        .slice(-limit)
        .reverse();
    }

    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((data || []) as any[]).map((d) => ({
      id: d.id,
      merchantId: d.merchant_id,
      storeId: d.store_id,
      productId: d.product_id,
      cartReference: d.cart_reference,
      customerId: d.customer_id,
      sessionTokenHash: d.session_token_hash,
      status: d.status,
      currentRound: d.current_round,
      attemptNumber: d.attempt_number || d.current_round,
      maxRounds: d.max_rounds,
      maxAttempts: d.max_rounds,
      originalPrice: parseFloat(d.original_price),
      currentOffer: d.current_offer ? parseFloat(d.current_offer) : undefined,
      initialCustomerOffer: d.initial_customer_offer ? parseFloat(d.initial_customer_offer) : undefined,
      finalAgreedPrice: d.final_agreed_price ? parseFloat(d.final_agreed_price) : undefined,
      currency: d.currency,
      expiresAt: d.expires_at,
      closedAt: d.closed_at,
      metadata: d.metadata || {},
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  /**
   * Cleans and resets the database state for tests
   */
  public static resetForTesting(): void {
    this.sessions.clear();
    this.messages.clear();
    this.offers.clear();
    this.transactions.clear();
    this.analytics = [];
    this.products.clear();
    this.rules.clear();
    this.merchants.clear();
    this.users.clear();
    this.stores.clear();

    // Reset default merchant
    this.merchants.set("a0000000-0000-0000-0000-000000000001", {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Apex Retail Brands",
      slug: "apex-retail",
      billingEmail: "admin@apexretail.test",
      tier: "GROWTH",
      status: "ACTIVE",
      maxStores: 3,
      settings: {
        defaultMaxRounds: 3,
        defaultStrategy: "MODERATE",
        defaultMaxDiscountPercentage: 25,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Reset default user
    this.users.set("b0000000-0000-0000-0000-000000000001", {
      id: "b0000000-0000-0000-0000-000000000001",
      merchantId: "a0000000-0000-0000-0000-000000000001",
      email: "merchant@apexretail.test",
      fullName: "Priya Sharma",
      passwordHash: this.DEFAULT_TEST_PASSWORD_HASH,
      role: "OWNER",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Reset default store
    this.stores.set("d0000000-0000-0000-0000-000000000001", {
      id: "d0000000-0000-0000-0000-000000000001",
      merchantId: "a0000000-0000-0000-0000-000000000001",
      platform: "SHOPIFY",
      platformStoreId: "apex-luxury.myshopify.com",
      storeName: "Apex Luxury Lifestyle",
      publicStoreKey: "pub_live_apex_9a8b7c6d5e4f3a2b1c",
      currency: "INR",
      status: "ACTIVE",
      settings: {
        brandColor: "#16a34a",
        widgetTheme: "auto",
        position: "bottom-right",
        requireEmailToClaim: false,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Reset default product
    this.products.set("e0000000-0000-0000-0000-000000000001", {
      id: "e0000000-0000-0000-0000-000000000001",
      storeId: "d0000000-0000-0000-0000-000000000001",
      externalProductId: "gid://shopify/Product/8472910381",
      title: "Artisan Leather Weekend Duffel Bag",
      handle: "artisan-leather-weekend-duffel-bag",
      sku: "AL-BAG-001",
      originalPrice: 2000.0,
      currency: "INR",
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
      inventoryQuantity: 15,
      isActive: true,
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Reset default rules
    this.rules.set("e0000000-0000-0000-0000-000000000001", {
      id: "f0000000-0000-0000-0000-000000000001",
      storeId: "d0000000-0000-0000-0000-000000000001",
      productId: "e0000000-0000-0000-0000-000000000001",
      isNegotiationEnabled: true,
      minAcceptablePrice: 1500.0,
      maxDiscountPercentage: 25.0,
      autoAcceptPrice: 1850.0,
      maxNegotiationRounds: 3,
      strategy: "MODERATE",
      minOrderQuantity: 1,
      couponValidityHours: 24,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
}
