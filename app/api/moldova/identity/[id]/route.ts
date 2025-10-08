import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.MOLDOVA_BASE_URL ?? "";
const API_PREFIX = process.env.MOLDOVA_API_PREFIX ?? "/moldova/v2";
const API_KEY = process.env.MOLDOVA_API_KEY ?? "";

const h = (): Record<string, string> => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { "x-api-key": API_KEY } : {}),
});
const url = (p: string) => `${BASE}${API_PREFIX}${p}`;
const extractId = (req: NextRequest) =>
  decodeURIComponent(req.nextUrl.pathname.replace(/^.*\/identity\//, "").replace(/\/$/, ""));

export async function PUT(req: NextRequest) {
  const id = extractId(req);
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

export async function DELETE(req: NextRequest) {
  const id = extractId(req);
  const res = await fetch(url(`/identity/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: h(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
