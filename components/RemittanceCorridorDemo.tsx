
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";

type Entity = { id: string; name: string; type: "bank" | "fintech"; country: "UZ" | "KR" };
type CCY = "UZS" | "KRW" | "USD";

type Props = { onStartFaceLogin?: () => void };

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

export default function RemittanceCorridorDemo({ onStartFaceLogin }: Props) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    try {
      const ls = localStorage.getItem("theme");
      const next = ls === "dark" || (!ls && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
      setTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    } catch {}
  }, []);

  const [uzEntity, setUzEntity] = useState<string>(UZ_ENTITIES[0].id);
  const [krEntity, setKrEntity] = useState<string>(KR_ENTITIES[0].id);
  const [direction, setDirection] = useState<"UZS_to_KRW" | "KRW_to_UZS">("UZS_to_KRW");
  const [uzCurrency, setUzCurrency] = useState<CCY>("UZS");
  const [amount, setAmount] = useState<string>("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("lv_verified") === "1";
      const uid = localStorage.getItem("lv_user_id");
      setIsLoggedIn(!!v);
      setUserId(uid);
    } catch {}
  }, []);

  function extractId(obj: any): string | null {
    if (!obj) return null;
    if (obj.id) return String(obj.id);
    if (obj.identityId) return String(obj.identityId);
    if (obj.matches && obj.matches[0]?.id) return String(obj.matches[0].id);
    if (obj.result?.id) return String(obj.result.id);
    return null;
  }

  const corridorKey = `${uzEntity}->${krEntity}`;
  const feeModel = FEE_TABLE[corridorKey];

  const senderCcy: CCY = direction === "UZS_to_KRW" ? uzCurrency : "KRW";
  const recipientCcy: CCY = direction === "UZS_to_KRW" ? "KRW" : uzCurrency;

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

  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";
  const formatNumber = (n: number) => n.toLocaleString();

  const handleLogout = () => {
    try { localStorage.removeItem("lv_verified"); localStorage.removeItem("lv_user_id"); } catch {}
    setIsLoggedIn(false);
    setUserId(null);
  };

  const handleDelete = async () => {
    if (!userId) return;
    try {
      await fetch(`/api/moldova/identity/${encodeURIComponent(userId)}`, { method: "DELETE" });
    } catch {}
    handleLogout();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src="/lv-logo-light.svg" alt="LightVision" className="block h-6 dark:hidden" />
            <img src="/lv-logo-dark.svg" alt="LightVision" className="hidden h-6 dark:block" />
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Uzbekistan ↔ South Korea</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); try { localStorage.setItem("theme", next); } catch {}; document.documentElement.classList.toggle("dark", next === "dark"); }} className="rounded-xl border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">{themeBtnLabel}</button>
            {!isLoggedIn ? (
              <button onClick={onStartFaceLogin ?? (() => (window.location.href = "/face-login"))} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Face Login</button>
            ) : (
              <div className="flex items-center gap-2">
                {userId && <span className="text-sm text-slate-700 dark:text-slate-200">ID: <span className="font-semibold">{userId}</span></span>}
                <button onClick={handleLogout} className="rounded-xl border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">Logout</button>
                <button onClick={handleDelete} className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white dark:bg-rose-500">Delete Identity</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <div className="grid gap-6 md:grid-cols-3">
          <section className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
            <div className="flex items-center justify-between border-b p-4 dark:border-slate-800">
              <div className="font-semibold text-slate-800 dark:text-slate-100">Corridor & Amount</div>
              <button
                onClick={() => {
                  setDirection((d) => (d === "UZS_to_KRW" ? "KRW_to_UZS" : "UZS_to_KRW"));
                  setUzEntity((prevUz) => {
                    const newUz = krEntity;
                    setKrEntity(prevUz);
                    return newUz as unknown as string;
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm dark:border-slate-700"
              >
                <ArrowLeftRight className="h-4 w-4" /> Swap direction
              </button>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">Uzbekistan Entity</label>
                <select value={uzEntity} onChange={(e) => setUzEntity(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {UZ_ENTITIES.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
                <label className="text-sm text-slate-600 dark:text-slate-300">Uz Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setUzCurrency("UZS")} className={`rounded-xl px-3 py-2 text-sm font-medium ${"UZS" === uzCurrency ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 dark:text-white"}`}>UZS</button>
                  <button onClick={() => setUzCurrency("USD")} className={`rounded-xl px-3 py-2 text-sm font-medium ${"USD" === uzCurrency ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 dark:text-white"}`}>USD</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">South Korea Entity</label>
                <select value={krEntity} onChange={(e) => setKrEntity(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {KR_ENTITIES.map((e) => (<option key={e.id} value={e.id}>{e.name}{e.type === "fintech" ? " (fintech)" : ""}</option>))}
                </select>
                <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800 dark:text-slate-100">
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
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">No fee model for this corridor.</div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
