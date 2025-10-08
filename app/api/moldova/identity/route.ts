import { NextResponse } from "next/server";

const base = process.env.MOLDOVA_BASE_URL || "";
const prefix = process.env.MOLDOVA_API_PREFIX || "/moldova/v2";
const key = process.env.MOLDOVA_API_KEY || "";

export async function POST(req: Request) {
  const body = await req.json();
  const url = new URL(`${prefix}/identity`, base).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
