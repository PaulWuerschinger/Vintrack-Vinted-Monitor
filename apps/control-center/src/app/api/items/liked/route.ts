import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createVintedServiceHeaders, VINTED_SERVICE_URL } from "@/lib/vinted-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ item_ids: [] });
  }

  try {
    const res = await fetch(`${VINTED_SERVICE_URL}/api/items/liked`, {
      headers: createVintedServiceHeaders(session.user.id, false),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ item_ids: [] });
  }
}
