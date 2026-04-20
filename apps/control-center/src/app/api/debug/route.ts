import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "set" : "MISSING";
  checks.AUTH_DISCORD_ID = process.env.AUTH_DISCORD_ID ? "set" : "MISSING";
  checks.AUTH_DISCORD_SECRET = process.env.AUTH_DISCORD_SECRET ? "set" : "MISSING";
  checks.DATABASE_URL = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@") : "MISSING";
  checks.AUTH_URL = process.env.AUTH_URL || "MISSING";
  checks.AUTH_TRUST_HOST = process.env.AUTH_TRUST_HOST || "MISSING";

  // Test DB connection
  try {
    const count = await db.user.count();
    checks.db = `connected (${count} users)`;
  } catch (e: any) {
    checks.db = `ERROR: ${e.message}`;
  }

  return NextResponse.json(checks);
}
