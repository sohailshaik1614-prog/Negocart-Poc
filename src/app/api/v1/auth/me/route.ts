import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/modules/auth/auth-service";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.cookies.get("negozaar_session")?.value;
    const authContext = await AuthService.resolveAuthContext(authHeader);

    const user = await NegoZaarRepository.getUserById(authContext.userId);
    const merchant = await NegoZaarRepository.getMerchantById(authContext.merchantId);
    const stores = await NegoZaarRepository.getStoresForMerchant(authContext.merchantId);

    if (!user || !merchant) {
      return NextResponse.json({ success: false, error: "User or merchant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        merchant: {
          id: merchant.id,
          name: merchant.name,
          slug: merchant.slug,
          tier: merchant.tier,
          settings: merchant.settings,
        },
        stores,
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
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
