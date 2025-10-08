import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.MOLDOVA_BASE_URL ?? "";
const API_PREFIX = process.env.MOLDOVA_API_PREFIX ?? "/moldova/v2";
const API_KEY = process.env.MOLDOVA_API_KEY ?? "";

const h = () =>
  ({
    "Content-Type": "application/json",
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
  } as Record<string, string>);

const url = (p: string) => `${BASE}${API_PREFIX}${p}`;

export async function PUT(
  req: NextRequest,
  context: { params: Record<string, string | string[]> }
) {
  const { id } = context.params as { id: string };
  const body = await req.json().catch(() => ({}));
  const res = await fetch(url(`/identity/${encodeURIComponent(id)}`), {
    method: "PUT",
    headers: h(),
    body: JSON.stringify({ image: body.image }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Record<string, string | string[]> }
) {
  const { id } = context.params as { id: string };
  const res = await fetch(url(`/identity/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: h(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
