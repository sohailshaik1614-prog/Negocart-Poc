import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { TenantContextManager } from "@/modules/tenancy/tenant-context";
import { NegoZaarRepository } from "@/database/repository";
import { ProductNegotiationSettings } from "@/core/types/rule.types";

const upsertRuleSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  isNegotiationEnabled: z.boolean(),
  minAcceptablePrice: z.number().positive("Floor price must be positive"),
  maxDiscountPercentage: z.number().min(0).max(100),
  autoAcceptPrice: z.number().positive().optional(),
  maxNegotiationRounds: z.number().min(1).max(10).default(3),
  strategy: z.enum(["AGGRESSIVE", "MODERATE", "FRIENDLY"]).default("MODERATE"),
  minOrderQuantity: z.number().min(1).default(1),
  couponValidityHours: z.number().min(1).default(24),
  customSystemPromptAddon: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "rules:read");

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const productId = searchParams.get("productId") || undefined;

    if (!storeId) {
      return NextResponse.json({ error: "Query parameter 'storeId' required" }, { status: 400 });
    }

    await TenantContextManager.validateStoreAccess(authContext, storeId);

    const rule = await NegoZaarRepository.getProductRule(storeId, productId);
    return NextResponse.json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "rules:write");

    const body = await req.json();
    const parsed = upsertRuleSchema.parse(body);

    await TenantContextManager.validateStoreAccess(authContext, parsed.storeId);

    // Validate floor price vs auto-accept
    if (parsed.autoAcceptPrice && parsed.autoAcceptPrice < parsed.minAcceptablePrice) {
      return NextResponse.json(
        { error: "Auto-accept price cannot be lower than the minimum acceptable floor price" },
        { status: 400 }
      );
    }

    const existing = await NegoZaarRepository.getProductRule(parsed.storeId, parsed.productId);

    const ruleToSave: ProductNegotiationSettings = {
      id: existing?.id || crypto.randomUUID(),
      storeId: parsed.storeId,
      productId: parsed.productId,
      isNegotiationEnabled: parsed.isNegotiationEnabled,
      minAcceptablePrice: parsed.minAcceptablePrice,
      maxDiscountPercentage: parsed.maxDiscountPercentage,
      autoAcceptPrice: parsed.autoAcceptPrice,
      maxNegotiationRounds: parsed.maxNegotiationRounds,
      strategy: parsed.strategy,
      minOrderQuantity: parsed.minOrderQuantity,
      couponValidityHours: parsed.couponValidityHours,
      customSystemPromptAddon: parsed.customSystemPromptAddon,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await NegoZaarRepository.upsertProductRule(ruleToSave);

    return NextResponse.json({ rule: ruleToSave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
