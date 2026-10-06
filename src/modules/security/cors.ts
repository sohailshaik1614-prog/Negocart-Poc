import { NextResponse } from "next/server";

export const WIDGET_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Store-Key",
};

/**
 * Returns a JSON response with permissive CORS headers for embeddable storefront widgets
 */
export function jsonWithCors(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      ...WIDGET_CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

/**
 * Standard preflight OPTIONS handler for widget endpoints
 */
export function corsOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: WIDGET_CORS_HEADERS,
  });
}
