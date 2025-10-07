import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const revalidate = 0;

const BASE = ((process.env.LV_AUTH_BASE_URL || "").replace(/\/+$/, "")) + "/";
const KEY = process.env.LV_AUTH_API_KEY || "";
const MOCK = process.env.MOCK_LV_AUTH === "1" || !BASE.trim();

function buildUrl(p: string) {
  const rel = (p || "").replace(/^\/+/, "");
  return new URL(rel, BASE).toString();
}

export async function POST(req: Request) {
  const { image, userId, name } = await req.json();
  if (!image) return NextResponse.json({ error: "missing image" }, { status: 400 });

  if (MOCK) return NextResponse.json({ ok: true, userId: userId || "demo", name: name || "Demo User" });

  const upstream = buildUrl(process.env.LV_AUTH_REGISTER_PATH || "api/register");
  const res = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({ image, userId, name }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  const out = NextResponse.json(data, { status: res.status });
  out.headers.set("x-upstream-url", upstream);
  return out;
}
