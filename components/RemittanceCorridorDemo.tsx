"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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
  const [profile, setProfile] = useState<null | { name?: string; userId?: string }>(null);
  const refreshAuth = () => {
    try {
      const verified = localStorage.getItem("lv_verified") === "1";
      setIsLoggedIn(verified);
      const raw = localStorage.getItem("lv_profile");
      setProfile(raw ? JSON.parse(raw) : null);
    } catch {}
  };
  useEffect(() => { refreshAuth(); }, []);
  useEffect(() => {
    const onFocus = () => refreshAuth();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

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

  const logout = () => {
    try { localStorage.removeItem("lv_verified"); } catch {}
    setIsLoggedIn(false);
  };

  const deleteProfile = async () => {
    try {
      const raw = localStorage.getItem("lv_profile");
      const p = raw ? JSON.parse(raw) : null;
      if (p?.userId) {
        await fetch("/api/lvauth/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.userId }) });
      }
    } catch {}
    try { localStorage.removeItem("lv_profile"); localStorage.removeItem("lv_verified"); } catch {}
    setProfile(null);
    setIsLoggedIn(false);
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const arrow = direction === "UZS_to_KRW" ? "→" : "←";
  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Image src="/lv-logo-light.png" alt="LightVision" width={112} height={24} className="block dark:hidden" />
            <Image src="/lv-logo-dark.png" alt="LightVision" width={112} height={24} className="hidden dark:block" />
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Uzbekistan {arrow} South Korea</h1>
          </div>
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
  useEffect(() => { try { const ls = localStorage.getItem("theme"); if (ls === "dark" || (!ls && window.matchMedia("(prefers-color-scheme: dark)").matches)) setTheme("dark"); else setTheme("light"); } catch {} }, []);
  useEffect(() => { if (typeof document !== "undefined") { document.documentElement.classList.toggle("dark", theme === "dark"); try { localStorage.setItem("theme", theme); } catch {} } }, [theme]);

  type FlowStep = "welcome" | "select" | "consent" | "capture" | "snapshotConfirm" | "alignConfirm" | "processing" | "result";
  const [step, setStep] = useState<FlowStep>("welcome");
  const [mode, setMode] = useState<"verify" | "register">("verify");
  const [userId, setUserId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginStatus, setLoginStatus] = useState<"idle" | "opening" | "capturing" | "verifying" | "success" | "failed">("idle");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [aligned, setAligned] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [finding, setFinding] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => { try { setIsLoggedIn(localStorage.getItem("lv_verified") === "1"); } catch {} }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const themeBtnLabel = mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme";

  const attachStreamToVideo = async () => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    // @ts-ignore
    if (v.srcObject !== s) v.srcObject = s;
    v.muted = true;
    // @ts-ignore
    v.playsInline = true;
    // @ts-ignore
    v.autoplay = true;
    await new Promise<void>((res) => {
      const onLoaded = () => { v.removeEventListener("loadedmetadata", onLoaded as any); res(); };
      v.addEventListener("loadedmetadata", onLoaded as any);
      if (v.readyState >= 1) res();
    });
    if (v.readyState < 2 || !v.videoWidth) {
      await new Promise<void>((res) => {
        const onCanPlay = () => { v.removeEventListener("canplay", onCanPlay as any); res(); };
        v.addEventListener("canplay", onCanPlay as any);
        if (v.readyState >= 2) res();
      });
    }
    try { await v.play(); } catch {}
    setVideoReady((v.videoWidth || 0) > 0);
  };

  const ensureCamera = async () => {
    if (!streamRef.current) {
      try {
        setLoginStatus("opening");
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        streamRef.current = stream;
      } catch {
        setLoginStatus("failed");
        setError("camera");
        return;
      }
    }
    await attachStreamToVideo();
    setLoginStatus("capturing");
  };

  async function callLV(path: string, body: any) {
    const res = await fetch(`/api/lvauth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "fail");
    return data;
  }

  const captureFromVideo = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setSnapshot(String(r.result));
    r.readAsDataURL(file);
  };

  useEffect(() => {
    if (step === "capture") ensureCamera();
  }, [step]);

  const nextStep = async () => {
    if (step === "welcome") setStep("select");
    else if (step === "select") setStep("consent");
    else if (step === "consent") setStep("capture");
    else if (step === "capture") {
      const img = snapshot || captureFromVideo();
      if (!img) { setError("camera"); return; }
      setSnapshot(img);
      setStep("snapshotConfirm");
    }
    else if (step === "snapshotConfirm") {
      setLoginStatus("verifying");
      setStep("alignConfirm");
      try {
        const a = await callLV("align", { image: snapshot });
        setAligned(a?.aligned || snapshot);
        setLoginStatus("idle");
      } catch {
        setAligned(snapshot);
        setLoginStatus("failed");
      }
    }
    else if (step === "alignConfirm") {
      setLoginStatus("verifying");
      setStep("processing");
      try {
        if (mode === "register") {
          const r = await callLV("register", { image: aligned, userId: userId || undefined });
          setResult(r);
        } else {
          const r = await callLV("verify", { image: snapshot });
          setResult(r);
          try { localStorage.setItem("lv_verified", "1"); } catch {}
          setIsLoggedIn(true);
        }
        setLoginStatus("success");
        setStep("result");
      } catch {
        setLoginStatus("failed");
        setError(mode);
        setStep("result");
      }
    }
    else if (step === "result") { if (onBack) onBack(); else window.location.href = "/"; }
  };

  const backStep = () => {
    if (step === "select") setStep("welcome");
    else if (step === "consent") setStep("select");
    else if (step === "capture") setStep("consent");
    else if (step === "snapshotConfirm") setStep("capture");
    else if (step === "alignConfirm") setStep("snapshotConfirm");
    else if (step === "result") setStep("welcome");
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) { /* @ts-ignore */ videoRef.current.srcObject = null; }
    setVideoReady(false);
  };
  useEffect(() => () => stopCamera(), []);

  const doFind = async () => {
    setFinding(true);
    try {
      await ensureCamera();
      const img = captureFromVideo() || snapshot;
      if (!img) { setFinding(false); return; }
      const r = await callLV("find", { image: img });
      setResult((prev: any) => ({ ...prev, find: r }));
    } finally { setFinding(false); }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <header className="border-b bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src="/lv-logo-light.png" alt="LightVision" className="block h-6 dark:hidden" />
            <img src="/lv-logo-dark.png" alt="LightVision" className="hidden h-6 dark:block" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Face</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">{themeBtnLabel}</button>
            <button onClick={() => { if (onBack) onBack(); else window.location.href = "/"; }} className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">Back</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-3">
        <section className="md:col-span-2 rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b p-4 font-semibold dark:border-slate-800">{step === "welcome" ? "Welcome" : step === "select" ? "Select" : step === "consent" ? "Consent" : step === "capture" ? "Capture" : step === "snapshotConfirm" ? "Confirm snapshot" : step === "alignConfirm" ? "Confirm aligned" : step === "processing" ? "Processing" : "Result"}</div>
          <div className="p-4 space-y-4">
            {step === "welcome" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">We will use your camera to verify or register your face.</p>
                <button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Start</button>
              </div>
            )}

            {step === "select" && (
              <div className="space-y-3">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button onClick={() => setMode("verify")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "verify" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Verify</button>
                  <button onClick={() => setMode("register")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "register" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Register</button>
                </div>
                {mode === "register" && (
                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-300">User ID</label>
                    <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g., test-user" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={nextStep} disabled={mode==='register' && !userId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Continue</button>
                  <button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button>
                </div>
              </div>
            )}

            {step === "consent" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">By continuing, you agree to capture and process facial imagery for {mode==='verify'?"verification":"registration"}.</p>
                <div className="flex gap-2"><button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">I agree</button><button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button></div>
              </div>
            )}

            {step === "capture" && (
              <div className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-xl bg-black/90 ring-1 ring-black/10">
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <button onClick={nextStep} disabled={!videoReady && !snapshot} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Capture Snapshot</button>
                  <label className="relative inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                    Upload Image
                    <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={ensureCamera} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">{loginStatus === "capturing" ? "Restart Camera" : loginStatus === "opening" ? "Opening..." : "Start Camera"}</button>
                  <button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button>
                </div>
                {!!snapshot && <div className="text-xs text-slate-500 dark:text-slate-400">Image loaded; you can continue.</div>}
              </div>
            )}

            {step === "snapshotConfirm" && snapshot && (
              <div className="space-y-3">
                <img src={snapshot} alt="snapshot" className="aspect-video w-full rounded-xl object-cover ring-1 ring-black/10" />
                <div className="flex gap-2">
                  <button onClick={() => setStep("capture")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Retake</button>
                  <button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Use this</button>
                </div>
              </div>
            )}

            {step === "alignConfirm" && (
              <div className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-xl bg-slate-100 ring-1 ring-black/10 dark:bg-slate-800">
                  {aligned ? <img src={aligned} alt="aligned" className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Aligning…</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep("snapshotConfirm")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button>
                  <button onClick={nextStep} disabled={!aligned && loginStatus!=="idle"} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Confirm aligned</button>
                </div>
              </div>
            )}

            {step === "processing" && (
              <div className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-1/3 animate-pulse rounded-full bg-slate-400 dark:bg-slate-600" /></div>
              </div>
            )}

            {step === "result" && (
              <div className="space-y-4">
                {result?.id && <div className="text-sm">Registered ID: <span className="font-semibold">{result.id}</span></div>}
                {result?.face && <img src={result.face} alt="registered" className="h-40 w-40 rounded-xl object-cover ring-1 ring-black/10" />}
                {!!error && <p className="text-sm text-rose-600">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Done</button>
                  <button onClick={() => setStep("welcome")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Restart</button>
                  <button onClick={doFind} disabled={finding} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500">{finding?"Finding…":"Find"}</button>
                </div>
                {result?.find && (
                  <div className="rounded-xl border p-3 text-sm dark:border-slate-800">
                    <div className="font-semibold">Find Result</div>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(result.find, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
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
