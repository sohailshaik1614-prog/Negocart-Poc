import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

const updateProductSchema = z.object({
  title: z.string().min(2).optional(),
  handle: z.string().optional(),
  sku: z.string().optional(),
  originalPrice: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  inventoryQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),

  // Negotiation configuration
  minAcceptablePrice: z.number().positive().optional(),
  isNegotiationEnabled: z.boolean().optional(),
  maxNegotiationRounds: z.number().int().min(1).max(10).optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  strategy: z.enum(["AGGRESSIVE", "MODERATE", "FRIENDLY"]).optional(),
  autoAcceptPrice: z.number().positive().optional(),
  minOrderQuantity: z.number().int().min(1).optional(),
  couponValidityHours: z.number().int().min(1).optional(),
  customSystemPromptAddon: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:read");

    const productId = params.id;

    // Strict Tenant Isolation Check: Ensures product belongs to authenticated merchant
    await TenantContextManager.validateProductAccess(authContext, productId);

    const productWithRules = await NegoZaarRepository.getProductWithRules(productId);
    if (!productWithRules) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: productWithRules,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:write");

    const productId = params.id;

    // Strict Tenant Isolation Check
    const existing = await TenantContextManager.validateProductAccess(authContext, productId);

    const body = await req.json();
    const parsed = updateProductSchema.parse(body);

    const effectiveOriginalPrice = parsed.originalPrice !== undefined ? parsed.originalPrice : existing.originalPrice;
    if (parsed.minAcceptablePrice && parsed.minAcceptablePrice > effectiveOriginalPrice) {
      return NextResponse.json(
        {
          success: false,
          error: "Minimum acceptable price cannot be higher than the original price",
          code: "FLOOR_EXCEEDS_ORIGINAL",
        },
        { status: 400 }
      );
    }

    const updated = await NegoZaarRepository.updateProduct(productId, {
      ...parsed,
      imageUrl: parsed.imageUrl || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Product and negotiation configuration updated successfully",
      data: updated,
    });
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
    const message = error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  return PATCH(req, context);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "products:write");

    const productId = params.id;

    // Strict Tenant Isolation Check
    await TenantContextManager.validateProductAccess(authContext, productId);

    await NegoZaarRepository.deleteProduct(productId);

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to delete product";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}
