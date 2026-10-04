import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

const createProductSchema = z.object({
  storeId: z.string().uuid("Valid store ID required").optional(),
  title: z.string().min(2, "Product title must be at least 2 characters"),
  handle: z.string().optional(),
  sku: z.string().optional(),
  originalPrice: z.number().positive("Original price must be greater than zero"),
  currency: z.string().length(3).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  inventoryQuantity: z.number().int().min(0).default(1),
  externalProductId: z.string().optional(),

  // Negotiation configuration
  minAcceptablePrice: z.number().positive("Minimum acceptable floor price must be greater than zero"),
  isNegotiationEnabled: z.boolean().default(true),
  maxNegotiationRounds: z.number().int().min(1).max(10).default(3),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  strategy: z.enum(["AGGRESSIVE", "MODERATE", "FRIENDLY"]).default("MODERATE"),
  autoAcceptPrice: z.number().positive().optional(),
  minOrderQuantity: z.number().int().min(1).default(1),
  couponValidityHours: z.number().int().min(1).default(24),
  customSystemPromptAddon: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:read");

    const { searchParams } = new URL(req.url);
    let storeId = searchParams.get("storeId");
    const search = searchParams.get("search") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const isNegotiationParam = searchParams.get("isNegotiationEnabled");

    if (!storeId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length === 0) {
        return NextResponse.json({ success: true, data: { products: [] } });
      }
      storeId = stores[0].id;
    }

    // Tenant Isolation Check
    await TenantContextManager.validateStoreAccess(authContext, storeId);

    const products = await NegoZaarRepository.getProductsForStore(storeId, {
      search,
      isActive: isActiveParam !== null ? isActiveParam === "true" : undefined,
      isNegotiationEnabled: isNegotiationParam !== null ? isNegotiationParam === "true" : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        products,
        total: products.length,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:write");

    const body = await req.json();
    const parsed = createProductSchema.parse(body);

    let targetStoreId = parsed.storeId;
    if (!targetStoreId) {
      const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);
      if (stores.length === 0) {
        return NextResponse.json({ success: false, error: "No stores found for merchant" }, { status: 404 });
      }
      targetStoreId = stores[0].id;
    }

    // Tenant Isolation Check
    await TenantContextManager.validateStoreAccess(authContext, targetStoreId);

    // Pricing Rule Invariant Validations
    if (parsed.minAcceptablePrice > parsed.originalPrice) {
      return NextResponse.json(
        {
          success: false,
          error: "Minimum acceptable price (floor price) cannot be higher than the original price",
          code: "FLOOR_EXCEEDS_ORIGINAL",
        },
        { status: 400 }
      );
    }

    if (parsed.autoAcceptPrice && parsed.autoAcceptPrice < parsed.minAcceptablePrice) {
      return NextResponse.json(
        {
          success: false,
          error: "Auto-accept price cannot be lower than the minimum acceptable floor price",
          code: "AUTO_ACCEPT_BELOW_FLOOR",
        },
        { status: 400 }
      );
    }

    const created = await NegoZaarRepository.createProduct({
      ...parsed,
      storeId: targetStoreId,
      imageUrl: parsed.imageUrl || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Product and negotiation configuration created successfully",
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
