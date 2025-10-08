
"use client";
import React, { useEffect, useRef, useState } from "react";

type Step = "select" | "capture" | "snapshotConfirm" | "alignConfirm" | "processing" | "result";

export default function Page() {
  const [step, setStep] = useState<Step>("select");
  const [mode, setMode] = useState<"verify" | "register">("verify");
  const [loginStatus, setLoginStatus] = useState<"idle" | "opening" | "capturing" | "verifying" | "success" | "failed">("idle");
  const [videoReady, setVideoReady] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [aligned, setAligned] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const resetAll = () => {
    setErrorMsg(null);
    setAlreadyRegistered(false);
    setSnapshot(null);
    setAligned(null);
    setResult(null);
    setLoginStatus("idle");
  };

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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        streamRef.current = stream;
      } catch (e: any) {
        setLoginStatus("failed");
        setErrorMsg("Could not access the camera. Please grant permission or try another device.");
        return;
      }
    }
    await attachStreamToVideo();
    setLoginStatus("capturing");
  };

  useEffect(() => { if (step === "capture") ensureCamera(); }, [step]);
  useEffect(() => () => { if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; } }, []);
  useEffect(() => { if (step === "select") { setErrorMsg(null); setAlreadyRegistered(false); } }, [step]);

  const captureFromVideo = () => {
    const v = videoRef.current; if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return null; ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.92);
  };

  const onFile = (file?: File | null) => { if (!file) return; const r = new FileReader(); r.onload = () => setSnapshot(String(r.result)); r.readAsDataURL(file); };
  const stripDataUrl = (d: string | null) => d ? d.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") : null;

  async function apiCreate(imageB64NoPrefix: string) {
    const id = Math.floor(Math.random()*10_000_000);
    const res = await fetch(`/api/moldova/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, image: imageB64NoPrefix })
    });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) {
      const e: any = new Error(j?.error || "Registration failed");
      e.status = res.status;
      e.data = j;
      throw e;
    }
    return j as { id: number; image: string };
  }

  async function apiConfirm(id: number|string, imageB64NoPrefix: string){
    const res = await fetch(`/api/moldova/identity/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageB64NoPrefix })
    });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) {
      const e: any = new Error(j?.error || "Registration confirmation failed");
      e.status = res.status;
      e.data = j;
      throw e;
    }
    return j;
  }

  async function apiCheck(imageB64NoPrefix: string){
    const res = await fetch(`/api/moldova/identity/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageB64NoPrefix })
    });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) {
      const e: any = new Error(j?.error || "Verification failed");
      e.status = res.status;
      e.data = j;
      throw e;
    }
    return j;
  }

  function extractId(obj: any): string | null {
    if (!obj) return null;
    if (obj.id) return String(obj.id);
    if (obj.identityId) return String(obj.identityId);
    if (obj.matches && obj.matches[0]?.id) return String(obj.matches[0].id);
    if (obj.result?.id) return String(obj.result.id);
    return null;
  }

  const nextStep = async (forceMode?: "verify" | "register") => {
    setErrorMsg(null);
    setAlreadyRegistered(false);
  
    if (step === "select") {
      setStep("capture");
      return;
    }
  
    if (step === "capture") {
      const img = captureFromVideo() || snapshot;
      if (!img) { setErrorMsg("No image captured. Please start the camera or upload a photo."); return; }
      setSnapshot(img);
      setStep("snapshotConfirm");
      return;
    }
  
    if (step === "snapshotConfirm") {
      const currentMode = forceMode ?? mode;
  
      if (currentMode === "register") {
        setLoginStatus("verifying");
        setStep("alignConfirm");
        try {
          const raw = stripDataUrl(snapshot);
          if (!raw) throw new Error("noimage");
          const created = await apiCreate(raw);
          setResult({ id: created.id });
          setAligned(`data:image/png;base64,${created.image}`);
          setLoginStatus("idle");
        } catch (e: any) {
          if (e?.status === 409) {
            setErrorMsg("You are already registered to the service. You can switch to verification.");
            setAlreadyRegistered(true);
            setLoginStatus("idle");
            setStep("snapshotConfirm");
            return;
          }
          setAligned(snapshot);
          setLoginStatus("failed");
          setErrorMsg(e?.message || "Registration failed. Please try again.");
          setStep("snapshotConfirm");
        }
        return;
      }
  
      // verify
      setLoginStatus("verifying");
      try {
        const raw = stripDataUrl(snapshot);
        if (!raw) throw new Error("nover");
        const r = await apiCheck(raw);
        setResult(r);
        const id = extractId(r);
        if (id) {
          try { localStorage.setItem("lv_verified", "1"); localStorage.setItem("lv_user_id", id); } catch {}
        }
        setLoginStatus("success");
        setErrorMsg(null);
        setStep("result");
      } catch (e: any) {
        setLoginStatus("failed");
        setErrorMsg(e?.message || "Verification failed. Please retake your photo and try again.");
        setStep("snapshotConfirm");
      }
      return;
    }
  
    if (step === "alignConfirm") {
      setLoginStatus("verifying");
      try {
        const id = (result?.id ?? "");
        const raw = stripDataUrl(aligned);
        if (!id || !raw) throw new Error("noconfirm");
        const r = await apiConfirm(id, raw);
        setResult((prev: any) => ({ ...prev, ...r, face: aligned }));
        const extractedId = extractId({ ...r, id });
        if (extractedId) {
          try { localStorage.setItem("lv_verified", "1"); localStorage.setItem("lv_user_id", extractedId); } catch {}
        }
        setLoginStatus("success");
        setErrorMsg(null);
        setStep("result");
      } catch (e: any) {
        setLoginStatus("failed");
        setErrorMsg(e?.message || "Registration confirmation failed. Please retry.");
        setStep("alignConfirm");
      }
      return;
    }
  
    if (step === "result") {
      window.location.href = "/";
    }
  };  

  const backStep = () => {
    setErrorMsg(null);
    setAlreadyRegistered(false);
    if (step === "capture") setStep("select");
    else if (step === "snapshotConfirm") { setSnapshot(null); setAligned(null); setStep("capture"); }
    else if (step === "alignConfirm") setStep("snapshotConfirm");
    else if (step === "result") setStep("select");
  };

  const onVerifyNow = () => {
    setMode("verify");
    nextStep("verify"); // force verify on this click
  };  

  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-3">
      <section className="md:col-span-2 rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b p-4 font-semibold dark:border-slate-800">
          {step === "select" ? "Select" : step === "capture" ? "Capture" : step === "snapshotConfirm" ? "Confirm snapshot" : step === "alignConfirm" ? "Confirm aligned" : step === "processing" ? "Processing" : "Result"}
        </div>
        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
              <div className="flex items-start justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => { setErrorMsg(null); setAlreadyRegistered(false); }} className="rounded-md px-2 py-1 text-xs ring-1 ring-rose-300 hover:bg-rose-100 dark:ring-rose-700 dark:hover:bg-rose-900/30">Dismiss</button>
              </div>
              {alreadyRegistered && step === "snapshotConfirm" && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={onVerifyNow} disabled={loginStatus === "verifying"} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Verify now</button>
                  <button onClick={() => { setErrorMsg(null); setAlreadyRegistered(false); setStep("select"); }} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back to selection</button>
                </div>
              )}
            </div>
          )}

          {step === "select" && (
            <div className="space-y-3">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button onClick={() => { setMode("verify"); setErrorMsg(null); setAlreadyRegistered(false); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "verify" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Verify</button>
                <button onClick={() => { setMode("register"); setErrorMsg(null); setAlreadyRegistered(false); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "register" ? "bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700" : "text-slate-600 dark:text-slate-300"}`}>Register</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => nextStep()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Continue</button>
                <button onClick={() => (window.location.href = "/")} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button>
              </div>
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-3">
              <div className="aspect-video overflow-hidden rounded-xl bg-black/90 ring-1 ring-black/10">
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <button onClick={() => nextStep()} disabled={!videoReady && !snapshot} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Capture Snapshot</button>
                <label className="relative inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  Upload Image
                  <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={ensureCamera} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  {loginStatus === "capturing" ? "Restart Camera" : loginStatus === "opening" ? "Opening..." : "Start Camera"}
                </button>
                <button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Back</button>
              </div>
              {!!snapshot && <div className="text-xs text-slate-500 dark:text-slate-400">Image loaded; you can continue.</div>}
            </div>
          )}

          {step === "snapshotConfirm" && snapshot && (
            <div className="space-y-3">
              <img src={snapshot} alt="snapshot" className="aspect-video w-full rounded-xl object-cover ring-1 ring-black/10" />
              <div className="flex gap-2">
                <button onClick={backStep} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Retake</button>
                <button onClick={() => nextStep()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">{mode === "register" ? "Use this" : "Verify"}</button>
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
                <button onClick={() => nextStep()} disabled={!aligned && loginStatus!=="idle"} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Confirm aligned</button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-1/3 animate-pulse rounded-full" /></div>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-4">
              {result?.id && <div className="text-sm">Registered ID: <span className="font-semibold">{String(result.id)}</span></div>}
              {result?.face && <img src={result.face} alt="registered" className="h-40 w-40 rounded-xl object-cover ring-1 ring-black/10" />}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => nextStep()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Done</button>
                <button onClick={() => { resetAll(); setStep("select"); }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">Restart</button>
              </div>
            </div>
          )}
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
