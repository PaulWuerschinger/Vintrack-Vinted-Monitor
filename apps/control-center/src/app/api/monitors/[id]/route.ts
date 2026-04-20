import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { validateApiRequest } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = parseInt(raw);
  return isNaN(n) ? null : n;
}

function getUserId(req: NextRequest): string | NextResponse | null {
  // Try API key auth first (service-to-service)
  const apiKey = process.env.API_KEY;
  if (req.headers.get("X-API-Key")) {
    const result = validateApiRequest(req);
    return result instanceof NextResponse ? result : result;
  }
  // Fall back to session auth (browser)
  return null; // caller must check session
}

// GET /api/monitors/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const monitorId = parseId(id);
  if (!monitorId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  // Try API key auth
  const apiResult = getUserId(req);
  if (apiResult instanceof NextResponse) return apiResult;

  let userId = apiResult;
  if (!userId) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = session.user.id;
  }

  const monitor = await db.monitors.findFirst({
    where: { id: monitorId, userId },
    include: { proxy_group: { select: { name: true } } },
  });

  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ monitor });
}

// PUT /api/monitors/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const result = validateApiRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;
  const monitorId = parseId(id);
  if (!monitorId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const existing = await db.monitors.findFirst({ where: { id: monitorId, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const monitor = await db.monitors.update({
    where: { id: monitorId, userId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.query !== undefined && { query: body.query.trim() }),
      ...(body.price_min !== undefined && { price_min: body.price_min }),
      ...(body.price_max !== undefined && { price_max: body.price_max }),
      ...(body.size_id !== undefined && { size_id: body.size_id }),
      ...(body.catalog_ids !== undefined && { catalog_ids: body.catalog_ids }),
      ...(body.brand_ids !== undefined && { brand_ids: body.brand_ids }),
      ...(body.color_ids !== undefined && { color_ids: body.color_ids }),
      ...(body.status_ids !== undefined && { status_ids: body.status_ids }),
      ...(body.region !== undefined && { region: body.region }),
      ...(body.allowed_countries !== undefined && { allowed_countries: body.allowed_countries }),
      ...(body.proxy_group_id !== undefined && { proxy_group_id: body.proxy_group_id }),
    },
  });

  return NextResponse.json({ monitor });
}

// DELETE /api/monitors/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const result = validateApiRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;
  const monitorId = parseId(id);
  if (!monitorId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await db.monitors.deleteMany({ where: { id: monitorId, userId } });
  return NextResponse.json({ status: "deleted" });
}

// PATCH /api/monitors/[id] — toggle status
export async function PATCH(req: NextRequest, { params }: Params) {
  const result = validateApiRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;
  const monitorId = parseId(id);
  if (!monitorId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const existing = await db.monitors.findFirst({ where: { id: monitorId, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = existing.status === "active" ? "paused" : "active";
  const monitor = await db.monitors.update({
    where: { id: monitorId, userId },
    data: { status: newStatus },
  });

  return NextResponse.json({ monitor });
}
