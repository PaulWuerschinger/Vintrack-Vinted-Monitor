import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { createVintedServiceHeaders, VINTED_SERVICE_URL } from "@/lib/vinted-service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.toString();
  const url = `${VINTED_SERVICE_URL}/api/messages/inbox${search ? `?${search}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: {
        ...createVintedServiceHeaders(session.user.id),
      },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Vinted service unreachable" }, { status: 502 });
  }
}
