"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Entity = { id: string; name: string; type: "bank" | "fintech"; country: "UZ" | "KR" };
type CCY = "UZS" | "KRW" | "USD";
type Theme = "light" | "dark";

type MainProps = { onStartFaceLogin?: () => void };
type FaceProps = { onBack?: () => void };

const UZ_ENTITIES: Entity[] = [
  { id: "paynet-bank", name: "Paynet Bank (mock)", type: "bank", country: "UZ" },
  { id: "agrobank", name: "Agrobank (mock)", type: "bank", country: "UZ" },
  { id: "qsystems-bank", name: "QSystems Bank (mock)", type: "bank", country: "UZ" }
];

const KR_ENTITIES: Entity[] = [
  { id: "kookmin", name: "KB Kookmin (mock)", type: "bank", country: "KR" },
  { id: "shinhan", name: "Shinhan (mock)", type: "bank", country: "KR" },
  { id: "toss", name: "Toss Payments (mock)", type: "fintech", country: "KR" },
  { id: "kakaopay", name: "KakaoPay (mock)", type: "fintech", country: "KR" }
];

const FX = {
  KRW_TO_UZS: 9.0,
  UZS_TO_KRW: 1 / 9.0,
  USD_TO_KRW: 1400,
  KRW_TO_USD: 1 / 1400,
  USD_TO_UZS: 12000,
  UZS_TO_USD: 1 / 12000
};

function convert(value: number, from: CCY, to: CCY) {
  if (from === to) return value;
  if (from === "KRW" && to === "UZS") return value * FX.KRW_TO_UZS;
  if (from === "UZS" && to === "KRW") return value * FX.UZS_TO_KRW;
  if (from === "USD" && to === "KRW") return value * FX.USD_TO_KRW;
  if (from === "KRW" && to === "USD") return value * FX.KRW_TO_USD;
  if (from === "USD" && to === "UZS") return value * FX.USD_TO_UZS;
  if (from === "UZS" && to === "USD") return value * FX.UZS_TO_USD;
  return value;
}

const FEE_TABLE: Record<string, { base: number; pct: number; min: number; max: number; settlementCurrency: "KRW" | "UZS" }> = {
  "paynet-bank->kookmin": { base: 2500, pct: 0.006, min: 3500, max: 120000, settlementCurrency: "KRW" },
  "paynet-bank->toss": { base: 1800, pct: 0.0075, min: 3000, max: 90000, settlementCurrency: "KRW" },
  "agrobank->shinhan": { base: 30000, pct: 0.0045, min: 35000, max: 1200000, settlementCurrency: "UZS" },
  "qsystems-bank->kakaopay": { base: 2200, pct: 0.0065, min: 3500, max: 100000, settlementCurrency: "KRW" }
};

export default function RemittanceMain({ onStartFaceLogin }: MainProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      const ls = localStorage.getItem("theme");
      if (ls === "dark" || (!ls && window.matchMedia("(prefers-color-scheme: dark)").matches)) setTheme("dark");
      else setTheme("light");
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      try { localStorage.setItem("theme", theme); } catch {}
    }
  }, [theme]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { try { setIsLoggedIn(localStorage.getItem("lv_verified") === "1"); } catch {} }, []);

  const [uzEntity, setUzEntity] = useState<string>(UZ_ENTITIES[0].id);
  const [krEntity, setKrEntity] = useState<string>(KR_ENTITIES[0].id);
  const [direction, setDirection] = useState<"UZS_to_KRW" | "KRW_to_UZS">("UZS_to_KRW");
  const [uzCurrency, setUzCurrency] = useState<CCY>("UZS");
  const [amount, setAmount] = useState<string>("");

  const senderCcy: CCY = direction === "UZS_to_KRW" ? uzCurrency : "KRW";
  const recipientCcy: CCY = direction === "UZS_to_KRW" ? "KRW" : uzCurrency;
  const corridorKey = `${uzEntity}->${krEntity}`;
  const feeModel = FEE_TABLE[corridorKey];

  const parsedAmount = useMemo(() => {
    const v = Number((amount || "").replace(/,/g, ""));
    return Number.isFinite(v) ? v : 0;
  }, [amount]);

  const quote = useMemo(() => {
    if (!feeModel) return { fee: 0, feeCcy: "KRW", recipientGets: 0 } as const;
    const base = feeModel.base;
    const pct = feeModel.pct * parsedAmount;
    const rawFeeSender = Math.min(Math.max(base + pct, feeModel.min), feeModel.max);
    const displayFee = Math.round(convert(rawFeeSender, senderCcy, feeModel.settlementCurrency as CCY));
    const grossRecipient = convert(parsedAmount, senderCcy, recipientCcy);
    const feeInRecipient = convert(rawFeeSender, senderCcy, recipientCcy);
    const recipientGets = Math.max(0, Math.round(grossRecipient - feeInRecipient));
    return { fee: displayFee, feeCcy: feeModel.settlementCurrency, recipientGets } as const;
  }, [feeModel, parsedAmount, senderCcy, recipientCcy]);

  const formatNumber = (n: number) => n.toLocaleString();
  const arrow = direction === "UZS_to_KRW" ? "→" : "←";
  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-2"><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">LightVision</span><h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Uzbekistan {arrow} South Korea</h1></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-xl border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">{themeBtnLabel}</button>
            {isLoggedIn ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Verified</span>
            ) : (
              <button onClick={onStartFaceLogin ?? (() => (window.location.href = "/face-login"))} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Face Login</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <div className="grid gap-6 md:grid-cols-3">
          <section className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
            <div className="flex items-center justify-between border-b p-4 dark:border-slate-800">
              <div className="font-semibold text-slate-800 dark:text-slate-100">Corridor & Amount</div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button onClick={() => setDirection("UZS_to_KRW")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${direction === "UZS_to_KRW" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>UZ → KR</button>
                <button onClick={() => setDirection("KRW_to_UZS")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${direction === "KRW_to_UZS" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>KR → UZ</button>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">Uzbekistan Entity</label>
                <select value={uzEntity} onChange={(e) => setUzEntity(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {UZ_ENTITIES.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
                <label className="text-sm text-slate-600 dark:text-slate-300">Uz Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setUzCurrency("UZS")} className={`rounded-xl px-3 py-2 text-sm font-medium ${uzCurrency === "UZS" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 dark:text-white"}`}>UZS</button>
                  <button onClick={() => setUzCurrency("USD")} className={`rounded-xl px-3 py-2 text-sm font-medium ${uzCurrency === "USD" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 dark:text-white"}`}>USD</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">South Korea Entity</label>
                <select value={krEntity} onChange={(e) => setKrEntity(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {KR_ENTITIES.map((e) => (<option key={e.id} value={e.id}>{e.name}{e.type === "fintech" ? " (fintech)" : ""}</option>))}
                </select>
                <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800 dark:text-slate-100">
                  <div className="flex items-center justify-between"><span>Corridor</span><span className="font-medium">{direction === "UZS_to_KRW" ? UZ_ENTITIES.find(e=>e.id===uzEntity)?.name : KR_ENTITIES.find(e=>e.id===krEntity)?.name} → {direction === "UZS_to_KRW" ? KR_ENTITIES.find(e=>e.id===krEntity)?.name : UZ_ENTITIES.find(e=>e.id===uzEntity)?.name}</span></div>
                  <div className="flex items-center justify-between"><span>Direction</span><span className="font-medium">{direction === "UZS_to_KRW" ? `${uzCurrency} → KRW` : `KRW → ${uzCurrency}`}</span></div>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-sm text-slate-600 dark:text-slate-300">Amount ({direction === "UZS_to_KRW" ? `${uzCurrency} (sender)` : "KRW (sender)"})</label>
                <input inputMode="numeric" placeholder={direction === "UZS_to_KRW" ? (uzCurrency === "UZS" ? "e.g., 2,000,000" : "e.g., 100") : "e.g., 500,000"} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500" />
                <div className="text-xs text-slate-500 dark:text-slate-400">1 USD ≈ {FX.USD_TO_KRW.toLocaleString()} KRW • 1 USD ≈ {FX.USD_TO_UZS.toLocaleString()} UZS</div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Quote</div>
            <div className="mt-3 rounded-xl border p-4 dark:border-slate-800">
              {feeModel ? (
                <div className="space-y-2 text-sm text-slate-800 dark:text-slate-100">
                  <div className="flex items-center justify-between"><span>Fee</span><span className="font-semibold">{formatNumber(quote.fee)} {quote.feeCcy}</span></div>
                  <div className="flex items-center justify-between"><span>Recipient gets</span><span className="font-semibold">{formatNumber(quote.recipientGets)} {recipientCcy}</span></div>
                  <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">Base + percentage with min/max (mock)</div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">No fee model configured for this corridor.</div>
              )}
            </div>
            <button className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900" disabled={!parsedAmount || !feeModel || !isLoggedIn}>Continue</button>
            {!isLoggedIn && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Please complete face login to proceed.</p>}
          </aside>
        </div>

        <TestPanel />

        <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="font-semibold text-slate-800 dark:text-slate-100">Integration Notes</div>
          <ul className="list-disc pl-5 pt-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Replace mock fee table and FX with your pricing engine endpoint.</li>
            <li>Swap demo face login with LV Auth flow.</li>
            <li>Persist quotes server-side with short expiry.</li>
            <li>Log login attempts and corridor quotes for audit.</li>
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} LightVision Inc.</footer>
    </div>
  );
}

export function FaceLogin({ onBack }: FaceProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      const ls = localStorage.getItem("theme");
      if (ls === "dark" || (!ls && window.matchMedia("(prefers-color-scheme: dark)").matches)) setTheme("dark");
      else setTheme("light");
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      try { localStorage.setItem("theme", theme); } catch {}
    }
  }, [theme]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { try { setIsLoggedIn(localStorage.getItem("lv_verified") === "1"); } catch {} }, []);

  const [loginStatus, setLoginStatus] = useState<"idle" | "opening" | "capturing" | "verifying" | "success" | "failed">("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCamera = async () => {
    try {
      setLoginStatus("opening");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        // @ts-ignore
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLoginStatus("capturing");
    } catch {
      setLoginStatus("failed");
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current) return;
    setLoginStatus("verifying");
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    await new Promise((r) => setTimeout(r, 1000));
    const ok = true;
    if (ok) {
      try { localStorage.setItem("lv_verified", "1"); } catch {}
      setLoginStatus("success");
      setIsLoggedIn(true);
      stopCamera();
      if (onBack) onBack(); else window.location.href = "/";
    } else {
      setLoginStatus("failed");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      // @ts-ignore
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopCamera(), []);
  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-2"><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">LightVision</span><span className="text-sm text-slate-500 dark:text-slate-400">Face Login</span></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">{themeBtnLabel}</button>
            <button onClick={() => { stopCamera(); if (onBack) onBack(); else window.location.href = "/"; }} className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">Back</button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-3">
        <section className="md:col-span-2 rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b p-4 font-semibold dark:border-slate-800">Verification</div>
          <div className="p-4">
            <div className="aspect-video overflow-hidden rounded-xl bg-black/90 ring-1 ring-black/10">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={openCamera} disabled={loginStatus === "capturing" || loginStatus === "verifying"} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{loginStatus === "capturing" ? "Camera Ready" : loginStatus === "opening" ? "Opening..." : "Start Camera"}</button>
              <button onClick={captureAndVerify} disabled={loginStatus !== "capturing"} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Verify Face</button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Demo only. Replace with LV Auth API.</p>
          </div>
        </section>
        <aside className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="font-semibold">Status</div>
          <div className="mt-3 space-y-2">
            <StatusRow label="Login" value={isLoggedIn ? "Verified" : "Not verified"} good={isLoggedIn} />
            <StatusRow label="Camera" value={loginStatus} />
          </div>
        </aside>
      </main>
    </div>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-xs font-medium ${good ? "text-emerald-600 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>{value}</span>
    </div>
  );
}

function TestPanel() {
  const tests = [
    { direction: "UZS_to_KRW" as const, uz: "paynet-bank", kr: "kookmin", amount: 2_000_000, uzCcy: "UZS" as CCY },
    { direction: "UZS_to_KRW" as const, uz: "qsystems-bank", kr: "kakaopay", amount: 1_000_000, uzCcy: "UZS" as CCY },
    { direction: "KRW_to_UZS" as const, uz: "agrobank", kr: "shinhan", amount: 500_000, uzCcy: "UZS" as CCY },
    { direction: "KRW_to_UZS" as const, uz: "paynet-bank", kr: "toss", amount: 750_000, uzCcy: "UZS" as CCY },
    { direction: "UZS_to_KRW" as const, uz: "paynet-bank", kr: "kookmin", amount: 100, uzCcy: "USD" as CCY },
    { direction: "KRW_to_UZS" as const, uz: "agrobank", kr: "shinhan", amount: 600_000, uzCcy: "USD" as CCY }
  ];
  const rows = tests.map((t) => {
    const key = `${t.uz}->${t.kr}`;
    const model = FEE_TABLE[key];
    if (!model) return { key, ok: false, fee: 0, ccy: "-", rec: 0, dir: t.direction };
    const senderCcy: CCY = t.direction === "UZS_to_KRW" ? t.uzCcy : "KRW";
    const recipientCcy: CCY = t.direction === "UZS_to_KRW" ? "KRW" : t.uzCcy;
    const rawFeeSender = Math.min(Math.max(model.base + model.pct * t.amount, model.min), model.max);
    const displayFee = Math.round(convert(rawFeeSender, senderCcy, model.settlementCurrency as CCY));
    const grossRecipient = convert(t.amount, senderCcy, recipientCcy);
    const feeRecipient = convert(rawFeeSender, senderCcy, recipientCcy);
    const recipientGets = Math.max(0, Math.round(grossRecipient - feeRecipient));
    const ok = rawFeeSender >= model.min && rawFeeSender <= model.max;
    return { key, ok, fee: displayFee, ccy: model.settlementCurrency, rec: recipientGets, dir: t.direction };
  });
  return (
    <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="font-semibold text-slate-800 dark:text-slate-100">Tests</div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500 dark:border-slate-800 dark:text-slate-300">
              <th className="py-2">Corridor</th>
              <th className="py-2">Direction</th>
              <th className="py-2">Fee</th>
              <th className="py-2">Currency</th>
              <th className="py-2">Recipient Gets</th>
              <th className="py-2">Min/Max OK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b dark:border-slate-800">
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.key}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.dir}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.fee.toLocaleString()}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.ccy}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.rec.toLocaleString()}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.ok ? "true" : "false"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
