"use client";

import { useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { FaVideo, FaMagic, FaDownload, FaImage, FaMicrophone } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import axios from "axios";
import toast from "react-hot-toast";
import CustomSelect from "@/components/studio/CustomSelect";
import { computeCost } from "@/lib/cost";
import { safeParseConfig, wantsList } from "@/lib/params";
import { getModel, DEFAULT_MODEL_ID, DURATION_MIN, DURATION_MAX } from "@/lib/models";

const UPLOAD_TYPES = ["image_list", "video_list", "audio_list"];

function fileMeta(type) {
  if (type === "video_list") return { accept: "video/*", icon: <FaVideo className="text-xl" />, label: "Video" };
  if (type === "audio_list") return { accept: "audio/*", icon: <FaMicrophone className="text-xl" />, label: "Audio" };
  return { accept: "image/*", icon: <FaImage className="text-xl" />, label: "Image" };
}

export default function VideoTemplate({ appInstance, activeCreation, onCreationCompleted, generating: propGenerating, setGenerating: propSetGenerating }) {
  const { status, update: refreshSession } = useSession();
  const cfg = useMemo(() => safeParseConfig(appInstance.config), [appInstance.config]);
  const model = getModel(cfg.modelEndpoint) || getModel(DEFAULT_MODEL_ID);
  const userParams = Array.isArray(cfg.userParams) ? cfg.userParams : [];
  const visibleParams = userParams.filter((p) => p.type !== "hidden" && p.key !== "prompt");
  const hasUploadParam = visibleParams.some((p) => UPLOAD_TYPES.includes(p.type));
  const showDefaultUpload = model.mode !== "t2v" && !hasUploadParam;
  const showPrompt = cfg.showPrompt !== false;

  const [prompt, setPrompt] = useState("");
  const [sourceImage, setSourceImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState({});
  const generating = propGenerating !== undefined ? propGenerating : localGenerating;
  const setGenerating = propSetGenerating !== undefined ? propSetGenerating : setLocalGenerating;
  const visionParams = userParams.filter((p) => p.autofill === "vision" && p.type !== "hidden");

  const [customValues, setCustomValues] = useState(() => {
    const initial = {};
    userParams.forEach((p) => {
      if (!p.key) return;
      initial[p.key] = p.defaultValue !== undefined ? p.defaultValue : UPLOAD_TYPES.includes(p.type) ? [] : "";
    });
    return initial;
  });

  const cost = computeCost(cfg, customValues);
  const duration = customValues.duration !== undefined && customValues.duration !== "" ? Number(customValues.duration) : cfg.duration || DURATION_MIN;

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await axios.post("/api/upload", formData);
    return data.url;
  };

  /** Fill every "autofill from image" field by describing the uploaded image server-side. */
  const runAutofill = async (imageUrl) => {
    if (!imageUrl || !visionParams.length) return;
    await Promise.all(
      visionParams.map(async (p) => {
        setAnalyzing((s) => ({ ...s, [p.key]: true }));
        try {
          const { data } = await axios.post("/api/analyze", { appId: appInstance.id, paramKey: p.key, imageUrl });
          setCustomValues((prev) => ({ ...prev, [p.key]: data.text }));
        } catch (err) {
          toast.error(err.response?.data?.error || `Could not analyse the image for "${p.label}" — you can type it yourself.`);
        } finally {
          setAnalyzing((s) => ({ ...s, [p.key]: false }));
        }
      })
    );
  };

  const firstImage = () => {
    if (sourceImage) return sourceImage;
    for (const p of userParams) {
      if (p.type === "image_list") {
        const v = customValues[p.key];
        const list = Array.isArray(v) ? v : v ? [v] : [];
        if (list[0]) return list[0];
      }
    }
    return null;
  };

  const handleSourceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setSourceImage(url);
      runAutofill(url);
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleParamUpload = async (e, param) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      const max = Math.max(1, Number(param.maxInputs) || 1);
      setCustomValues((prev) => {
        const list = Array.isArray(prev[param.key]) ? prev[param.key] : [];
        return { ...prev, [param.key]: [...list, url].slice(0, max) };
      });
      if (param.type === "image_list" && !sourceImage) runAutofill(url);
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeParamFile = (key, idx) => {
    setCustomValues((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (status !== "authenticated") {
      signIn(undefined, { callbackUrl: window.location.pathname });
      return;
    }
    if (showPrompt && !prompt.trim() && !cfg.systemPrompt) {
      toast.error("Please describe your video first.");
      return;
    }
    if (showDefaultUpload && !sourceImage && cfg.requireImage) {
      toast.error("Please upload an image first.");
      return;
    }
    if (Object.values(analyzing).some(Boolean)) {
      toast.error("Still analysing your image — one moment.");
      return;
    }
    const missing = visibleParams.find((p) => {
      if (!p.required) return false;
      const v = customValues[p.key];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    });
    if (missing) {
      toast.error(`Please fill in "${missing.label}".`);
      return;
    }

    setGenerating(true);
    const toastId = toast.loading("Sending your request to H3 Max…");
    try {
      const payload = { appId: appInstance.id, prompt: prompt.trim(), inputImage: sourceImage };
      visibleParams.forEach((p) => {
        const v = customValues[p.key];
        if (UPLOAD_TYPES.includes(p.type)) {
          const list = Array.isArray(v) ? v : v ? [v] : [];
          payload[p.key] = wantsList(p) ? list : list[0] || "";
        } else {
          payload[p.key] = v;
        }
      });

      const { data } = await axios.post("/api/generation", payload);
      if (data.status === "failed") {
        toast.error(data.error || "Generation failed. Credits refunded.", { id: toastId });
      } else if (data.status === "completed") {
        toast.success(data.mock ? "Mock clip ready (no fal.ai key configured)." : "Your clip is ready!", { id: toastId });
      } else {
        toast.success(`Queued · ${data.cost} credits reserved. Rendering usually takes 1–3 minutes.`, { id: toastId });
      }
      refreshSession?.(); // pull the new credit balance into the navbar
      onCreationCompleted(data);
    } catch (err) {
      const code = err.response?.status;
      if (code === 401) {
        toast.error("Please sign in to generate.", { id: toastId });
        signIn(undefined, { callbackUrl: window.location.pathname });
      } else if (code === 402) {
        toast.error(
          <span>
            Not enough credits. <Link href="/pricing" className="underline font-bold">Top up</Link>
          </span>,
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.error(err.response?.data?.error || "Generation failed.", { id: toastId });
      }
      setGenerating(false);
    }
  };

  const handleDownload = (url) => {
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(url)}`;
    a.download = `h3max_${appInstance.slug || appInstance.id}_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderParam = (param) => {
    const value = customValues[param.key];
    const isVision = param.autofill === "vision";
    const busy = !!analyzing[param.key];
    const label = (
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-secondary-text uppercase tracking-wider block">
          {param.label}
          {param.required && <span className="text-primary"> *</span>}
        </label>
        {isVision &&
          (busy ? (
            <span className="text-[10px] text-primary font-bold flex items-center gap-1">
              <FiRefreshCw className="animate-spin" /> Reading your image…
            </span>
          ) : firstImage() ? (
            <button type="button" onClick={() => runAutofill(firstImage())} className="text-[10px] text-primary font-bold hover:underline cursor-pointer">
              Re-detect
            </button>
          ) : (
            <span className="text-[10px] text-secondary-text">auto-filled from your image</span>
          ))}
      </div>
    );

    if (UPLOAD_TYPES.includes(param.type)) {
      const urls = Array.isArray(value) ? value : value ? [value] : [];
      const max = Math.max(1, Number(param.maxInputs) || 1);
      const meta = fileMeta(param.type);
      return (
        <div key={param.key} className="space-y-3">
          <div className="flex justify-between items-center">
            {label}
            <span className="text-[10px] text-secondary-text font-bold bg-bg-page px-2 py-0.5 rounded border border-divider">
              {urls.length}/{max}
            </span>
          </div>
          {urls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {urls.map((url, idx) => (
                <div key={idx} className="relative aspect-square border border-divider rounded bg-bg-page/80 overflow-hidden">
                  {param.type === "image_list" ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary">{meta.icon}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeParamFile(param.key, idx)}
                    className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {urls.length < max && (
            <label className="border-2 border-dashed border-divider hover:border-primary/50 transition-colors rounded-lg h-24 flex flex-col items-center justify-center bg-bg-page/40 p-2 cursor-pointer text-xs font-semibold text-secondary-text gap-1.5">
              {meta.icon}
              <span className="text-[10px]">{uploading ? "Uploading…" : `Upload ${meta.label}`}</span>
              <input type="file" className="hidden" accept={meta.accept} disabled={uploading} onChange={(e) => handleParamUpload(e, param)} />
            </label>
          )}
          {param.help && <p className="text-[10px] text-secondary-text">{param.help}</p>}
        </div>
      );
    }

    if (param.type === "boolean") {
      return (
        <div key={param.key} className="flex items-center justify-between py-2 border-b border-divider/20">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-primary-text block">{param.label}</span>
            {param.help && <span className="text-[10px] text-secondary-text">{param.help}</span>}
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === "true"}
              onChange={(e) => setCustomValues((prev) => ({ ...prev, [param.key]: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-bg-page rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-secondary-text peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary border border-divider" />
          </label>
        </div>
      );
    }

    if (param.type === "enum") {
      const options = Array.isArray(param.options) ? param.options : [];
      return (
        <div key={param.key} className="space-y-2">
          {label}
          <CustomSelect
            value={value}
            onChange={(val) => setCustomValues((prev) => ({ ...prev, [param.key]: val }))}
            options={options.map((opt) => ({ label: opt, value: opt }))}
          />
        </div>
      );
    }

    if (param.type === "slider") {
      const isDuration = param.key === "duration";
      const min = param.min ?? (isDuration ? DURATION_MIN : 0);
      const max = param.max ?? (isDuration ? DURATION_MAX : 100);
      return (
        <div key={param.key} className="space-y-2">
          <div className="flex justify-between items-center">
            {label}
            <span className="text-xs font-bold text-primary">
              {value}
              {isDuration ? "s" : ""}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={param.step ?? 1}
            value={value}
            onChange={(e) => setCustomValues((prev) => ({ ...prev, [param.key]: Number(e.target.value) }))}
            className="w-full accent-primary h-1.5 bg-bg-page rounded-lg appearance-none cursor-pointer border border-divider"
          />
        </div>
      );
    }

    if (param.type === "number") {
      return (
        <div key={param.key} className="space-y-2">
          {label}
          <input
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            step={param.step ?? 1}
            onChange={(e) => setCustomValues((prev) => ({ ...prev, [param.key]: Number(e.target.value) }))}
            className="w-full bg-bg-page border border-divider rounded py-2.5 px-3 text-xs outline-none focus:border-primary/60 transition-colors font-medium text-primary-text"
          />
        </div>
      );
    }

    if (param.type === "textarea") {
      return (
        <div key={param.key} className="space-y-2">
          {label}
          <textarea
            value={value}
            disabled={busy}
            onChange={(e) => setCustomValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
            placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}…`}
            className="w-full bg-bg-page border border-divider rounded p-3 text-xs outline-none focus:border-primary/60 transition-colors h-24 resize-none font-medium placeholder-secondary-text leading-relaxed disabled:opacity-60"
          />
          {param.help && <p className="text-[10px] text-secondary-text">{param.help}</p>}
        </div>
      );
    }

    return (
      <div key={param.key} className="space-y-2">
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => setCustomValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
          placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}…`}
          className="w-full bg-bg-page border border-divider rounded py-2.5 px-3 text-xs outline-none focus:border-primary/60 transition-colors font-medium text-primary-text"
        />
      </div>
    );
  };

  const isMock = activeCreation?.requestId?.startsWith("mock_");

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl items-stretch">
      {/* Input form */}
      <div className="w-full lg:w-[400px] shrink-0 border border-divider/40 bg-bg-card/30 p-6 rounded-lg flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
            <FaVideo className="text-xs" /> {appInstance.name}
          </h2>
          <p className="text-[11px] text-secondary-text mt-1">
            {model.family} · {cfg.resolution || "768P"} · {duration}s{cfg.aspectRatio ? ` · ${cfg.aspectRatio}` : ""}
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          {showDefaultUpload && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-secondary-text uppercase tracking-wider">
                {model.mode === "r2v" ? "Reference image" : "Your image"}
                {!cfg.requireImage && <span className="normal-case font-semibold text-secondary-text/70"> (optional)</span>}
              </label>
              <div className="relative border-2 border-dashed border-divider hover:border-primary/50 transition-colors rounded-lg h-36 flex items-center justify-center bg-bg-page/40 p-3">
                {sourceImage ? (
                  <div className="w-full h-full relative group">
                    <img src={sourceImage} alt="Uploaded" className="w-full h-full object-contain rounded" />
                    <button
                      type="button"
                      onClick={() => setSourceImage(null)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-bold transition-opacity rounded"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-xs font-semibold text-secondary-text">
                    <FaImage className="text-xl" />
                    <span>{uploading ? "Uploading…" : "Click to upload (JPG / PNG / WebP)"}</span>
                    <input type="file" onChange={handleSourceUpload} className="hidden" accept="image/*" disabled={uploading} />
                  </label>
                )}
              </div>
            </div>
          )}

          {visibleParams.map(renderParam)}

          {showPrompt && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-secondary-text uppercase tracking-wider">{cfg.promptLabel || "Describe your video"}</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={cfg.promptPlaceholder || "What should happen in the clip?"}
                className="w-full bg-bg-page border border-divider rounded p-3 text-xs outline-none focus:border-primary/60 transition-colors h-24 resize-none font-medium placeholder-secondary-text leading-relaxed"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={generating || uploading}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3 rounded-full text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            {generating ? (
              <>
                <FiRefreshCw className="animate-spin text-sm" />
                <span>Rendering…</span>
              </>
            ) : status === "authenticated" ? (
              <>
                <FaMagic className="text-xs" />
                <span>Generate · {cost} credits</span>
              </>
            ) : (
              <span>Sign in to generate · {cost} credits</span>
            )}
          </button>
          <p className="text-[10px] text-secondary-text text-center">
            Failed renders are refunded automatically. Powered by MiniMax H3 Max on fal.ai.
          </p>
        </form>
      </div>

      {/* Output */}
      <div className="flex-1 border border-divider/30 bg-bg-card/10 rounded-lg p-6 flex flex-col items-center justify-center min-h-[420px]">
        {activeCreation ? (
          <div className="w-full max-w-2xl space-y-5">
            <div
              className="relative w-full rounded overflow-hidden bg-black border border-divider shadow-xl"
              style={{ aspectRatio: (activeCreation.aspectRatio || cfg.aspectRatio || "16:9").replace(":", "/") }}
            >
              {activeCreation.status === "processing" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-xs font-semibold text-secondary-text">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="animate-pulse">H3 Max is rendering your clip…</span>
                  <span className="text-[10px] font-normal">This usually takes 1–3 minutes. You can leave this page; the clip will be in your gallery.</span>
                </div>
              ) : activeCreation.status === "completed" ? (
                <video key={activeCreation.resultImage} src={activeCreation.resultImage} className="w-full h-full object-contain" controls autoPlay loop playsInline />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-red-400 font-bold px-6 text-center">
                  <span>Generation failed — credits refunded.</span>
                  <span className="text-[10px] text-secondary-text font-normal">{activeCreation.error || "Unknown error"}</span>
                </div>
              )}
            </div>

            <div className="bg-bg-card border border-divider p-4 rounded-lg flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-bold text-primary-text truncate">{activeCreation.prompt || "(image only)"}</p>
                <div className="flex items-center gap-2 text-[10px] text-secondary-text flex-wrap">
                  <span className="uppercase font-bold tracking-widest text-primary">{activeCreation.status}</span>
                  {activeCreation.resolution && <span>· {activeCreation.resolution}</span>}
                  {activeCreation.duration && <span>· {activeCreation.duration}s</span>}
                  <span>· {activeCreation.creditCost} credits</span>
                  {isMock && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">MOCK</span>}
                </div>
              </div>
              {activeCreation.status === "completed" && (
                <button
                  onClick={() => handleDownload(activeCreation.resultImage)}
                  className="bg-bg-page hover:bg-bg-card border border-divider rounded-full p-3 text-primary transition-all active:scale-95 shrink-0 cursor-pointer"
                  title="Download MP4"
                >
                  <FaDownload className="text-xs" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-xs text-secondary-text font-bold uppercase tracking-wider text-center px-6">
            <FaVideo className="text-3xl opacity-30 mb-2" />
            <span>Your clip will appear here</span>
            <span className="text-[10px] font-normal normal-case max-w-sm">{appInstance.description || "Fill in the form and hit Generate."}</span>
          </div>
        )}
      </div>
    </div>
  );
}
