import { NextResponse } from "next/server";

const base = process.env.MOLDOVA_BASE_URL || "";
const prefix = process.env.MOLDOVA_API_PREFIX || "/moldova/v2";
const key = process.env.MOLDOVA_API_KEY || "";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const url = new URL(`${prefix}/identity/${params.id}`, base).toString();
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const url = new URL(`${prefix}/identity/${params.id}`, base).toString();
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
