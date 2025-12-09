"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

type Country = "KR" | "UZ";
type CCY = "KRW" | "UZS" | "USD";
type Entity = { id: string; name: string; type: "bank" | "fintech"; country: Country };
type Props = { onStartFaceLogin?: () => void };

type CorridorQuote = {
  sender: Entity;
  recipient: Entity;
  fee: number;           // fee in sender currency
  feeCcy: CCY;           // equals sender currency
  estMinutes: number;    // mock speed
  recipientGets: number; // in recipient local currency
};

// Entities
const UZ_ENTITIES: Entity[] = [
  { id: "openbank", name: "Openbank", type: "bank", country: "UZ" },
  { id: "asaka", name: "Asaka Bank", type: "bank", country: "UZ" },
  { id: "sqb", name: "SQB", type: "bank", country: "UZ" },
  { id: "kapital", name: "Kapital Bank", type: "bank", country: "UZ" }
];
const KR_ENTITIES: Entity[] = [
  { id: "cnbpay", name: "CNB Pay", type: "fintech", country: "KR" },
  { id: "moin", name: "Moin", type: "fintech", country: "KR" },
  { id: "paygate", name: "Paygate", type: "fintech", country: "KR" }
];

// Mid-market baselines (mock, corrected): 1 UZS = 0.12 KRW → 1 KRW = 8.333333… UZS
const KRW_TO_UZS = 8.333333333333334;
const UZS_TO_KRW = 0.12;
const USD_TO_KRW = 1400;
const KRW_TO_USD = 1 / USD_TO_KRW;
const USD_TO_UZS = USD_TO_KRW * KRW_TO_UZS; // ≈ 11,666.666…
const UZS_TO_USD = 1 / USD_TO_UZS;

function midMarket(from: CCY, to: CCY): number {
  if (from === to) return 1;
  if (from === "KRW" && to === "UZS") return KRW_TO_UZS;
  if (from === "UZS" && to === "KRW") return UZS_TO_KRW;
  if (from === "USD" && to === "KRW") return USD_TO_KRW;
  if (from === "KRW" && to === "USD") return KRW_TO_USD;
  if (from === "USD" && to === "UZS") return USD_TO_UZS;
  if (from === "UZS" && to === "USD") return UZS_TO_USD;
  return 1;
}

// Base corridor models (UI hides FX margin; used only in math)
type Model = { base: number; pct: number; min: number; max: number; minutes: number; fxMarginPct: number };
const KR_MODELS: Record<string, Model> = {
  cnbpay:  { base: 1200, pct: 0.0040, min: 1500, max: 120000, minutes: 30, fxMarginPct: 0.0060 },
  moin:    { base: 1500, pct: 0.0035, min: 1800, max: 100000, minutes: 45, fxMarginPct: 0.0055 },
  paygate: { base:  900, pct: 0.0050, min: 1200, max:  80000, minutes: 15, fxMarginPct: 0.0070 }
};
const UZ_MODELS: Record<string, Model> = {
  openbank: { base: 15000, pct: 0.0040, min: 18000, max: 1200000, minutes: 60, fxMarginPct: 0.0080 },
  asaka:    { base: 16000, pct: 0.0042, min: 19000, max: 1300000, minutes: 65, fxMarginPct: 0.0082 },
  sqb:      { base: 14000, pct: 0.0038, min: 17000, max: 1100000, minutes: 55, fxMarginPct: 0.0078 },
  kapital:  { base: 15500, pct: 0.0041, min: 18500, max: 1250000, minutes: 62, fxMarginPct: 0.0081 }
};

// Corridor pair adjustments: fee multiplier and minutes offset per sender-recipient pair
type CorridorPairAdjust = { feeMultiplier: number; minutesOffset: number };
const CORRIDOR_PAIR_ADJUSTS: Record<string, Record<string, CorridorPairAdjust>> = {
  // KR -> UZ corridors
  cnbpay: {
    openbank: { feeMultiplier: 1.0, minutesOffset: 0 },
    asaka:    { feeMultiplier: 0.8, minutesOffset: -5 },
    sqb:      { feeMultiplier: 1.05, minutesOffset: 5 },
    kapital:  { feeMultiplier: 0.9, minutesOffset: -2 }
  },
  moin: {
    openbank: { feeMultiplier: 0.7, minutesOffset: 3 },
    asaka:    { feeMultiplier: 1.0, minutesOffset: 0 },
    sqb:      { feeMultiplier: 0.9, minutesOffset: -8 },
    kapital:  { feeMultiplier: 1.2, minutesOffset: 4 }
  },
  paygate: {
    openbank: { feeMultiplier: 1.1, minutesOffset: -3 },
    asaka:    { feeMultiplier: 1.2, minutesOffset: 2 },
    sqb:      { feeMultiplier: 1.3, minutesOffset: 0 },
    kapital:  { feeMultiplier: 1.5, minutesOffset: -1 }
  },
  // UZ -> KR corridors
  openbank: {
    cnbpay:  { feeMultiplier: 1.0, minutesOffset: 0 },
    moin:    { feeMultiplier: 1.1, minutesOffset: 6 },
    paygate: { feeMultiplier: 0.9, minutesOffset: -4 }
  },
  asaka: {
    cnbpay:  { feeMultiplier: 0.9, minutesOffset: -3 },
    moin:    { feeMultiplier: 1.0, minutesOffset: 0 },
    paygate: { feeMultiplier: 1.2, minutesOffset: 3 }
  },
  sqb: {
    cnbpay:  { feeMultiplier: 1.0, minutesOffset: 4 },
    moin:    { feeMultiplier: 0.9, minutesOffset: -5 },
    paygate: { feeMultiplier: 1.1, minutesOffset: 2 }
  },
  kapital: {
    cnbpay:  { feeMultiplier: 0.9, minutesOffset: -2 },
    moin:    { feeMultiplier: 1.0, minutesOffset: 7 },
    paygate: { feeMultiplier: 1.1, minutesOffset: -6 }
  }
};

// --- Randomization (per visit, persisted in sessionStorage) ---
type FxMap = Record<string, number>;
type FeeCore = { base: number; pct: number; min: number; max: number };
type FeeMap = Record<string, FeeCore>;
const FX_KEY = "fxMarginsV1";
const FEE_KEY = "feeOverridesV1";

const clamp = (n: number, min = 0, max = 0.05) => Math.min(Math.max(n, min), max);
// FX margin jitter: ±0.20% around base, clamped to [0, 5%]
const jitterFx = (base: number, spread = 0.002) =>
  Number(clamp(base + (Math.random() * 2 - 1) * spread, 0, 0.05).toFixed(4));
const jitterPct = (n: number, ratio = 0.25) => jitterFx(n, n * ratio);

// Fee jitter helpers
const toHundreds = (n: number) => Math.max(0, Math.round(n / 100) * 100);
const jitterAbsHundreds = (n: number, ratio = 0.15) =>
  toHundreds(n * (1 + (Math.random() * 2 - 1) * ratio));

function genFxMargins(): FxMap {
  return {
    cnbpay:  jitterFx(KR_MODELS.cnbpay.fxMarginPct),
    moin:    jitterFx(KR_MODELS.moin.fxMarginPct),
    paygate: jitterFx(KR_MODELS.paygate.fxMarginPct),
    uz_openbank: jitterFx(UZ_MODELS.openbank.fxMarginPct),
    uz_asaka:    jitterFx(UZ_MODELS.asaka.fxMarginPct),
    uz_sqb:      jitterFx(UZ_MODELS.sqb.fxMarginPct),
    uz_kapital:  jitterFx(UZ_MODELS.kapital.fxMarginPct),
  };
}
function genFeeOverrides(): FeeMap {
  const j = (m: FeeCore): FeeCore => {
    const base = jitterAbsHundreds(m.base, 0.15);
    const min  = jitterAbsHundreds(m.min, 0.15);
    const max  = Math.max(jitterAbsHundreds(m.max, 0.15), min + 100);
    const pct  = jitterPct(m.pct, 0.25);
    return { base, pct, min, max };
  };
  return {
    cnbpay: j(KR_MODELS.cnbpay),
    moin: j(KR_MODELS.moin),
    paygate: j(KR_MODELS.paygate),
    uz_openbank: j(UZ_MODELS.openbank),
    uz_asaka: j(UZ_MODELS.asaka),
    uz_sqb: j(UZ_MODELS.sqb),
    uz_kapital: j(UZ_MODELS.kapital),
  };
}

function loadFxMargins(): FxMap {
  try { const s = sessionStorage.getItem(FX_KEY); if (s) return JSON.parse(s); } catch {}
  const fx = genFxMargins();
  try { sessionStorage.setItem(FX_KEY, JSON.stringify(fx)); } catch {}
  return fx;
}
function loadFeeOverrides(): FeeMap {
  try { const s = sessionStorage.getItem(FEE_KEY); if (s) return JSON.parse(s); } catch {}
  const o = genFeeOverrides();
  try { sessionStorage.setItem(FEE_KEY, JSON.stringify(o)); } catch {}
  return o;
}

function calcFee(amount: number, m: FeeCore): number {
  const min = toHundreds(m.min);
  const max = Math.max(toHundreds(m.max), min + 100);
  const raw = m.base + m.pct * amount;
  const rounded = toHundreds(raw);
  return Math.min(Math.max(rounded, min), max);
}


export default function RemittanceCorridorDemo({ onStartFaceLogin }: Props) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [senderCountry, setSenderCountry] = useState<Country>("KR");
  const recipientCountry: Country = senderCountry === "KR" ? "UZ" : "KR";
  const senderCurrencies: CCY[] = senderCountry === "KR" ? ["KRW", "USD"] : ["UZS", "USD"];
  const [senderCcy, setSenderCcy] = useState<CCY>(senderCurrencies[0]);
  const [amountStr, setAmountStr] = useState<string>("");

  const [fxMargins, setFxMargins] = useState<FxMap | null>(null);
  const [feeOverrides, setFeeOverrides] = useState<FeeMap | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    try {
      const ls = localStorage.getItem("theme");
      const next = ls === "dark" || (!ls && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
      setTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      const v = localStorage.getItem("lv_verified") === "1";
      const uid = localStorage.getItem("lv_user_id");
      setIsLoggedIn(!!v);
      setUserId(uid);
    } catch {}
    // load randomized params once
    try { setFxMargins(loadFxMargins()); } catch {}
    try { setFeeOverrides(loadFeeOverrides()); } catch {}
  }, []);
  useEffect(() => { setSenderCcy(senderCurrencies[0]); }, [senderCountry]);

  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";
  const amount = useMemo(() => {
    const v = Number((amountStr || "").replace(/,/g, ""));
    return Number.isFinite(v) ? v : 0;
  }, [amountStr]);

  const recipientLocal: CCY = recipientCountry === "KR" ? "KRW" : "UZS";
  const midline = useMemo(() => {
    const rate = midMarket(senderCcy, recipientLocal);
    return `Mid-market: 1 ${senderCcy} ≈ ${rate.toFixed(6)} ${recipientLocal}`;
  }, [senderCcy, recipientLocal]);

  const quotes: CorridorQuote[] = useMemo(() => {
    if (!amount || amount <= 0) return [];
    let allQuotes: CorridorQuote[];
    if (senderCountry === "KR") {
      allQuotes = KR_ENTITIES.flatMap((k) => {
        const base = KR_MODELS[k.id];
        const feeModel = (feeOverrides?.[k.id] ?? base) as FeeCore;
        const baseFee = calcFee(amount, feeModel);
        const margin = fxMargins?.[k.id] ?? base.fxMarginPct;
        const effectiveRate = midMarket(senderCcy, recipientLocal) * (1 - margin);
        // const recipientGets = Math.max(0, Math.round((amount - fee) * effectiveRate));
        const recipientGets = Math.max(0, Math.round(amount * effectiveRate));
        return UZ_ENTITIES.map((uz) => {
          const pairAdjust = CORRIDOR_PAIR_ADJUSTS[k.id]?.[uz.id] ?? { feeMultiplier: 1.0, minutesOffset: 0 };
          const adjustedFee = toHundreds(baseFee * pairAdjust.feeMultiplier);
          const adjustedMinutes = Math.max(1, base.minutes + pairAdjust.minutesOffset);
          return {
            sender: k,
            recipient: uz,
            fee: adjustedFee,
            feeCcy: senderCcy,
            estMinutes: adjustedMinutes,
            recipientGets
          };
        });
      });
    } else {
      allQuotes = UZ_ENTITIES.flatMap((uz) => {
        const base = UZ_MODELS[uz.id];
        const feeModel = (feeOverrides?.[`uz_${uz.id}`] ?? base) as FeeCore;
        const baseFee = calcFee(amount, feeModel);
        const margin = fxMargins?.[`uz_${uz.id}`] ?? base.fxMarginPct;
        const effectiveRate = midMarket(senderCcy, recipientLocal) * (1 - margin);
        return KR_ENTITIES.map((k) => {
          const pairAdjust = CORRIDOR_PAIR_ADJUSTS[uz.id]?.[k.id] ?? { feeMultiplier: 1.0, minutesOffset: 0 };
          const adjustedFee = toHundreds(baseFee * pairAdjust.feeMultiplier);
          const adjustedMinutes = Math.max(1, base.minutes + pairAdjust.minutesOffset);
          // const recipientGets = Math.max(0, Math.round((amount - fee) * effectiveRate));
          const recipientGets = Math.max(0, Math.round(amount * effectiveRate));
          return { sender: uz, recipient: k, fee: adjustedFee, feeCcy: senderCcy, estMinutes: adjustedMinutes, recipientGets };
        });
      });
    }
    
    // x
    const groupedBySender = new Map<string, CorridorQuote[]>();
    for (const quote of allQuotes) {
      const senderId = quote.sender.id;
      if (!groupedBySender.has(senderId)) {
        groupedBySender.set(senderId, []);
      }
      groupedBySender.get(senderId)!.push(quote);
    }
    
    const filteredQuotes: CorridorQuote[] = [];
    for (const [_, quotesForSender] of groupedBySender) {
      // fee 기준으로 정렬하고 상위 2개만 선택
      const sortedByFee = [...quotesForSender].sort((a, b) => a.fee - b.fee);
      filteredQuotes.push(...sortedByFee.slice(0, 2));
    }
    
    // recipientGets에 작은 랜덤 차감 적용 (0~1% 범위)
    const quotesWithRandomDeduction = filteredQuotes.map(quote => ({
      ...quote,
      recipientGets: Math.max(0, Math.round(quote.recipientGets * (1 - Math.random() * 0.01)))
    }));
    
    // recipientGets 기준으로 최종 정렬 후 상위 5개만 반환
    return quotesWithRandomDeduction.sort((a, b) => b.recipientGets - a.recipientGets).slice(0, 5);
  }, [amount, senderCountry, senderCcy, recipientLocal, fxMargins, feeOverrides]);

  const goToSender = (_q: CorridorQuote) => {
    const url = "https://www.oneremit.co.kr/web/main.view"; // placeholder
    if (typeof window !== "undefined") window.location.href = url;
  };
  const handleLogout = () => { try { localStorage.removeItem("lv_verified"); localStorage.removeItem("lv_user_id"); } catch {}; setIsLoggedIn(false); setUserId(null); };
  const handleDelete = async () => { if (!userId) return; try { await fetch(`/api/moldova/identity/${encodeURIComponent(userId)}`, { method: "DELETE" }); } catch {}; handleLogout(); };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src="/openbank.svg" alt="Openbank" className="block h-6 dark:invert" />
            <img src="/lv-logo-light.png" alt="LightVision" className="block h-6 dark:hidden" />
            <img src="/lv-logo-dark.png" alt="LightVision" className="hidden h-6 dark:block" />
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Compare Corridors</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                try { localStorage.setItem("theme", next); } catch {}
                document.documentElement.classList.toggle("dark", next === "dark");
              }}
              className="rounded-xl border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {themeBtnLabel}
            </button>

            {!isLoggedIn ? (
              <button
                onClick={() => (onStartFaceLogin ? onStartFaceLogin() : (window.location.href = "/face-login"))}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                Face Login
              </button>
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
          <section className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-3">
            <div className="border-b p-4 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">1) Sending from</div>
              <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button onClick={() => setSenderCountry("KR")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${senderCountry === "KR" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Korea</button>
                <button onClick={() => setSenderCountry("UZ")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${senderCountry === "UZ" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Uzbekistan</button>
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                Sending to: <span className="font-medium">{senderCountry === "KR" ? "Uzbekistan (UZ)" : "Korea (KR)"}</span>
              </div>
            </div>

            <div className="border-b p-4 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">2) Choose currency</div>
              <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {(senderCountry === "KR" ? ["KRW", "USD"] : ["UZS", "USD"]).map((ccy) => (
                  <button key={ccy} onClick={() => setSenderCcy(ccy as CCY)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${senderCcy === ccy ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>{ccy}</button>
                ))}
              </div>
            </div>

            <div className="border-b p-4 dark:border-slate-800">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">3) Enter amount</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  inputMode="numeric"
                  placeholder={senderCountry === "KR" ? (senderCcy === "KRW" ? "e.g., 500,000" : "e.g., 200") : (senderCcy === "UZS" ? "e.g., 2,000,000" : "e.g., 200")}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {midline}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">4) Highest payout</div>
              {amount > 0 ? (
                <ul className="mt-3 space-y-3">
                  {quotes.map((q) => (
                    <li key={`${q.sender.id}->${q.recipient.id}`}>
                      <button
                        onClick={() => goToSender(q)}
                        className="group flex w-full items-center justify-between rounded-2xl border p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {q.sender.name} → {q.recipient.name}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Fee: {(() => {
                              const modelCcy: CCY = senderCountry === "KR" ? "KRW" : "UZS";
                              const convertedFee = q.fee * midMarket(modelCcy, senderCcy);
                              return convertedFee.toLocaleString();
                            })()} {senderCcy} • ETA ~{q.estMinutes} min
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              {q.recipientGets.toLocaleString()} {recipientLocal}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Recipient gets</div>
                          </div>
                          <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                        </div>
                      </button>
                    </li>
                  ))}
                  {quotes.length === 0 && (
                    <li className="text-sm text-slate-500 dark:text-slate-400">No corridors available.</li>
                  )}
                </ul>
              ) : (
                <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Enter an amount to see corridors sorted by lowest fee and highest payout.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
