import { NextRequest, NextResponse } from "next/server";

/**
 * Validates API key for service-to-service calls.
 * Returns the userId from X-User-ID header if valid, or a NextResponse error.
 */
export function validateApiRequest(req: NextRequest): string | NextResponse {
  const apiKey = process.env.API_KEY;
  if (apiKey && req.headers.get("X-API-Key") !== apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
  }

  const userId = req.headers.get("X-User-ID");
  if (!userId) {
    return NextResponse.json({ error: "Missing X-User-ID" }, { status: 401 });
  }

  return userId;
}
// force rebuild 1776040525
