import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiRequest } from "@/lib/api-auth";

// GET /api/monitors — list monitors for a user
export async function GET(req: NextRequest) {
  const result = validateApiRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const monitors = await db.monitors.findMany({
    where: { userId },
    include: { proxy_group: { select: { name: true } } },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ monitors });
}

// POST /api/monitors — create a monitor
export async function POST(req: NextRequest) {
  const result = validateApiRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const body = await req.json();

  const name = (body.name || "").trim();
  const query = (body.query || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > 255) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  const monitor = await db.monitors.create({
    data: {
      userId,
      name,
      query,
      price_min: body.price_min ?? null,
      price_max: body.price_max ?? null,
      size_id: body.size_id ?? null,
      catalog_ids: body.catalog_ids ?? null,
      brand_ids: body.brand_ids ?? null,
      color_ids: body.color_ids ?? null,
      status_ids: body.status_ids ?? null,
      region: body.region || "de",
      allowed_countries: body.allowed_countries ?? null,
      discord_webhook: null,
      proxy_group_id: body.proxy_group_id ?? null,
      status: "active",
      webhook_active: false,
    },
  });

  return NextResponse.json({ monitor }, { status: 201 });
}
