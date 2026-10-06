import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/modules/auth/auth-service";
import { RBAC } from "@/modules/auth/rbac";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

const updateSettingsSchema = z.object({
  defaultMaxRounds: z.number().min(1).max(10).optional(),
  defaultStrategy: z.enum(["AGGRESSIVE", "MODERATE", "FRIENDLY"]).optional(),
  defaultMaxDiscountPercentage: z.number().min(0).max(100).optional(),
  notificationEmail: z.string().email().optional(),
  autoAcceptThresholdPercentage: z.number().min(0).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);

    const merchant = await NegoZaarRepository.getMerchantById(authContext.merchantId);
    if (!merchant) {
      return NextResponse.json({ success: false, error: "Merchant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: merchant.settings,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.cookies.get("negozaar_session")?.value ||
      (process.env.NODE_ENV !== "production" ? "Bearer dev-demo-token" : null);
    const authContext = await AuthService.resolveAuthContext(authHeader);
    RBAC.assertPermission(authContext.role, "rules:write");

    const body = await req.json();
    const parsed = updateSettingsSchema.parse(body);

    const merchant = await NegoZaarRepository.getMerchantById(authContext.merchantId);
    if (!merchant) {
      return NextResponse.json({ success: false, error: "Merchant not found" }, { status: 404 });
    }

    const updatedSettings = {
      ...merchant.settings,
      ...parsed,
    };

    const updated = await NegoZaarRepository.updateMerchant(authContext.merchantId, {
      settings: updatedSettings,
    });

    return NextResponse.json({
      success: true,
      message: "Merchant settings updated successfully",
      data: updated.settings,
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
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
