import { NextResponse } from "next/server";
import { env } from "@/config/env";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "NegoZaar API",
    version: "0.1.0",
    environment: env.NODE_ENV,
    aiProvider: env.AI_PROVIDER,
    timestamp: new Date().toISOString(),
  });
}
