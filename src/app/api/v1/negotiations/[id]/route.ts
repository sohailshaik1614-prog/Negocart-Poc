import { NextRequest, NextResponse } from "next/server";
import { NegoZaarRepository } from "@/database/repository";
import { DomainError } from "@/core/errors/domain-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const session = await NegoZaarRepository.getSessionById(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Negotiation session not found" },
        { status: 404 }
      );
    }

    const messages = await NegoZaarRepository.getSessionMessages(sessionId);
    const offers = await NegoZaarRepository.getSessionOffers(sessionId);
    const product = await NegoZaarRepository.getProductById(session.productId);

    return NextResponse.json({
      success: true,
      data: {
        session,
        product: product
          ? {
              id: product.id,
              title: product.title,
              originalPrice: product.originalPrice,
              currency: product.currency,
              imageUrl: product.imageUrl,
            }
          : undefined,
        messages,
        offers,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve session";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
