"use client";
import React, { useEffect, useRef, useState } from "react";

type Step = "welcome" | "select" | "consent" | "capture" | "snapshotConfirm" | "alignConfirm" | "processing" | "result";

export default function Page() {
  const [step, setStep] = useState<Step>("welcome");
  const [mode, setMode] = useState<"verify" | "register">("verify");
  const [userId, setUserId] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "opening" | "capturing" | "verifying" | "success" | "failed">("idle");
  const [videoReady, setVideoReady] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [aligned, setAligned] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [finding, setFinding] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const attachStreamToVideo = async () => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    // @ts-ignore
    if (v.srcObject !== s) v.srcObject = s;
    v.muted = true;
    // @ts-ignore
    v.playsInline = true; v.autoplay = true;
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        streamRef.current = stream;
      } catch {
        setLoginStatus("failed");
        return;
      }
    }
    await attachStreamToVideo();
    setLoginStatus("capturing");
  };

  useEffect(() => { if (step === "capture") ensureCamera(); }, [step]);
  useEffect(() => () => { if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; } }, []);

  const captureFromVideo = () => {
    const v = videoRef.current; if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return null; ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.92);
  };

  const onFile = (file?: File | null) => { if (!file) return; const r = new FileReader(); r.onload = () => setSnapshot(String(r.result)); r.readAsDataURL(file); };

  const stripDataUrl = (d: string | null) => d ? d.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") : null;

  async function apiCreate(imageB64NoPrefix: string, userIdValue?: string) {
    const id = Math.floor(Math.random()*10_000_000);
    const r = await fetch(`/api/moldova/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, image: imageB64NoPrefix, userId: userIdValue })
    });
    const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||"fail"); return j as { id: number; image: string };
  }

  async function apiConfirm(id: number|string, imageB64NoPrefix: string){
    const r = await fetch(`/api/moldova/identity/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageB64NoPrefix })
    });
    const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||"fail"); return j;
  }

  async function apiCheck(imageB64NoPrefix: string){
    const r = await fetch(`/api/moldova/identity/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageB64NoPrefix })
    });
    const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||"fail"); return j;
  }

  const nextStep = async () => {
    if (step === "welcome") setStep("select");
    else if (step === "select") setStep("consent");
    else if (step === "consent") setStep("capture");
    else if (step === "capture") { const img = snapshot || captureFromVideo(); if (!img) return; setSnapshot(img); setStep("snapshotConfirm"); }
    else if (step === "snapshotConfirm") {
      setLoginStatus("verifying"); setStep("alignConfirm");
      try {
        const raw = stripDataUrl(snapshot);
        if(!raw) throw new Error("noimage");
        const created = await apiCreate(raw, mode === "register" ? userId || undefined : undefined);
        setResult({ id: created.id });
        setAligned(`data:image/png;base64,${created.image}`);
        setLoginStatus("idle");
      } catch {
        setAligned(snapshot);
        setLoginStatus("failed");
      }
    }
    else if (step === "alignConfirm") {
      setLoginStatus("verifying"); setStep("processing");
      try {
        if (mode === "register") {
          const id = (result?.id ?? "");
          const raw = stripDataUrl(aligned);
          if(!id || !raw) throw new Error("noconfirm");
          const r = await apiConfirm(id, raw);
          setResult((prev:any)=>({ ...prev, ...r, face: aligned }));
        } else {
          const raw = stripDataUrl(snapshot);
          if(!raw) throw new Error("nover");
          const r = await apiCheck(raw);
          setResult(r);
          try { localStorage.setItem("lv_verified", "1"); } catch {}
        }
        setLoginStatus("success"); setStep("result");
      } catch {
        setLoginStatus("failed"); setStep("result");
      }
    }
    else if (step === "result") { window.location.href = "/"; }
  };

  const backStep = () => {
    if (step === "select") setStep("welcome");
    else if (step === "consent") setStep("select");
    else if (step === "capture") setStep("consent");
    else if (step === "snapshotConfirm") setStep("capture");
    else if (step === "alignConfirm") setStep("snapshotConfirm");
    else if (step === "result") setStep("welcome");
  };

  const doFind = async () => {
    setFinding(true);
    try {
      await ensureCamera();
      const img = captureFromVideo() || snapshot;
      const raw = stripDataUrl(img);
      if (!raw) return;
      const r = await apiCheck(raw);
      setResult((prev: any) => ({ ...prev, find: r }));
    } finally { setFinding(false); }
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-3">
      <section className="md:col-span-2 rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b p-4 font-semibold dark:border-slate-800">{step === "welcome" ? "Welcome" : step === "select" ? "Select" : step === "consent" ? "Consent" : step === "capture" ? "Capture" : step === "snapshotConfirm" ? "Confirm snapshot" : step === "alignConfirm" ? "Confirm aligned" : step === "processing" ? "Processing" : "Result"}</div>
        <div className="p-4 space-y-4">
          {step === "welcome" && (<div className="space-y-3"><p className="text-sm text-slate-600 dark:text-slate-300">We will use your camera to verify or register your face.</p><button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Start</button></div>)}

          {step === "select" && (
            <div className="space-y-3">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button onClick={() => setMode("verify")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "verify" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Verify</button>
                <button onClick={() => setMode("register")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "register" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Register</button>
              </div>
              {mode === "register" && (<div><label className="text-xs text-slate-600 dark:text-slate-300">User ID</label><input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g., test-user" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>)}
              <div className="flex gap-2"><button onClick={nextStep} disabled={mode==='register' && !userId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Continue</button><button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button></div>
            </div>
          )}

          {step === "consent" && (<div className="space-y-3"><p className="text-sm text-slate-600 dark:text-slate-300">By continuing, you agree to capture and process facial imagery for {mode==='verify'?"verification":"registration"}.</p><div className="flex gap-2"><button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">I agree</button><button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button></div></div>)}

          {step === "capture" && (<div className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-black/90 ring-1 ring-black/10"><video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" /></div><div className="grid gap-2 md:grid-cols-2"><button onClick={nextStep} disabled={!videoReady} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Capture Snapshot</button><label className="relative inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Upload Image<input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label></div><div className="flex gap-2"><button onClick={ensureCamera} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">{loginStatus === "capturing" ? "Restart Camera" : loginStatus === "opening" ? "Opening..." : "Start Camera"}</button><button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button></div></div>)}

          {step === "snapshotConfirm" && snapshot && (<div className="space-y-3"><img src={snapshot} alt="snapshot" className="aspect-video w-full rounded-xl object-cover ring-1 ring-black/10" /><div className="flex gap-2"><button onClick={() => setStep("capture")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Retake</button><button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Use this</button></div></div>)}

          {step === "alignConfirm" && (<div className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-slate-100 ring-1 ring-black/10 dark:bg-slate-800">{aligned ? <img src={aligned} alt="aligned" className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Aligning…</div>}</div><div className="flex gap-2"><button onClick={() => setStep("snapshotConfirm")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button><button onClick={nextStep} disabled={!aligned && loginStatus!=="idle"} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Confirm aligned</button></div></div>)}

          {step === "processing" && (<div className="space-y-3"><div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-1/3 animate-pulse rounded-full bg-slate-400 dark:bg-slate-600" /></div></div>)}

          {step === "result" && (<div className="space-y-4">{result?.id && <div className="text-sm">Registered ID: <span className="font-semibold">{result.id}</span></div>}{result?.face && <img src={result.face} alt="registered" className="h-40 w-40 rounded-xl object-cover ring-1 ring-black/10" />}<div className="flex flex-wrap gap-2"><button onClick={nextStep} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Done</button><button onClick={() => setStep("welcome")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Restart</button><button onClick={async()=>{await doFind();}} disabled={finding} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500">{finding?"Finding…":"Find"}</button></div>{result?.find && (<div className="rounded-xl border p-3 text-sm dark:border-slate-800"><div className="font-semibold">Find Result</div><pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(result.find, null, 2)}</pre></div>)}</div>)}
        </div>
      </section>

      <aside className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="font-semibold">Status</div>
        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div>Camera: {loginStatus}</div>
        </div>
      </aside>
    </main>
  );
}
