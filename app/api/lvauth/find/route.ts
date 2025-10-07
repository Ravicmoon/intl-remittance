import { NextResponse } from "next/server";

const base = process.env.LV_AUTH_BASE_URL || "";
const path = process.env.LV_AUTH_FIND_PATH || "/api/find";
const key = process.env.LV_AUTH_API_KEY || "";
const mock = process.env.MOCK_LV_AUTH === "1" || !base;

export async function POST(req: Request) {
  const { image } = await req.json();
  if (mock) return NextResponse.json({ ok: true, matches: [{ id: "demo-user", score: 0.99 }], count: 1 });
  const res = await fetch(new URL(path, base).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ image })
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
