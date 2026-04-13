import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { createVintedServiceHeaders, VINTED_SERVICE_URL } from "@/lib/vinted-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.text();
    const res = await fetch(`${VINTED_SERVICE_URL}/api/items/like`, {
      method: "POST",
      headers: createVintedServiceHeaders(session.user.id),
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Vinted service unreachable" }, { status: 502 });
  }
}
