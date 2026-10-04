import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/modules/auth/auth-service";
import { DomainError } from "@/core/errors/domain-errors";

const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  merchantName: z.string().min(2, "Merchant organization name must be at least 2 characters"),
  storeName: z.string().optional(),
  platformStoreId: z.string().optional(),
  currency: z.string().length(3).default("INR"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.parse(body);

    const result = await AuthService.registerMerchant(parsed);

    const response = NextResponse.json(
      {
        success: true,
        message: "Merchant registered successfully",
        data: result,
      },
      { status: 201 }
    );

    // Set secure HTTP-only cookie for session
    response.cookies.set("negozaar_session", result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 86400,
      path: "/",
    });

    return response;
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
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
