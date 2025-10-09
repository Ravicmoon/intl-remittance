import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const base = process.env.MOLDOVA_BASE_URL || "";
const prefix = process.env.MOLDOVA_API_PREFIX || "/moldova/v2";
const key = process.env.MOLDOVA_API_KEY || "";
const allow = ["POST", "OPTIONS"];

const headersCommon = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": allow.join(", "),
  "Allow": allow.join(", "),
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headersCommon });
}

export async function POST(req: Request) {
  const body = await req.json();
  const url = new URL(`${prefix}/identity/check`, base).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
