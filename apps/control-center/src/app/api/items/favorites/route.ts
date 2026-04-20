import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createVintedServiceHeaders, VINTED_SERVICE_URL } from "@/lib/vinted-service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "";

  try {
    const res = await fetch(`${VINTED_SERVICE_URL}/api/items/favorites?page=${page}`, {
      headers: createVintedServiceHeaders(session.user.id, false),
      cache: "no-store",
    });
    
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(errData || { error: "Failed to fetch favorites" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/items/favorites] Error proxying request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
